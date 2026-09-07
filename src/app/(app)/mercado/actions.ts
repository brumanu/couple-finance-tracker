"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, opcional, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  resolverClassificacao,
  revalidar,
  ROTAS_DO_SALDO,
  type EstadoForm,
} from "@/lib/acoes";
import type { StatusItem } from "@/lib/mercado";

export type MercadoFormState = EstadoForm;

const ROTA = "/mercado";

const STATUS_VALIDOS: readonly StatusItem[] = [
  "pendente",
  "carrinho",
  "nao_encontrado",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Confere que a lista existe e ainda está aberta.
 *
 * Todas as mutações de item passam por aqui. Sem isso, uma aba esquecida
 * aberta no celular continuaria mandando toques pra uma lista já finalizada —
 * e esses itens entrariam no histórico de uma compra que já virou despesa.
 *
 * A RLS já garante que a lista é do casal; o que falta checar é o estado.
 */
async function listaAberta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listaId: string,
): Promise<string | null> {
  if (!UUID_RE.test(listaId)) return "Lista inválida.";

  const { data, error } = await supabase
    .from("listas_mercado")
    .select("status")
    .eq("id", listaId)
    .maybeSingle();

  if (error) return erroAmigavel(error);
  if (!data) return "Lista não encontrada.";
  if (data.status !== "aberta") return "Esta compra já foi finalizada.";
  return null;
}

/**
 * Abre a lista da próxima ida ao mercado.
 *
 * O índice único parcial da migration 0016 garante uma lista aberta por
 * casal, então dois toques simultâneos (ou os dois celulares ao mesmo tempo)
 * dão 23505 no segundo. Nesse caso não é erro: alguém já abriu, e a resposta
 * certa é devolver a lista que existe.
 */
export async function criarListaMercado(): Promise<
  { id: string } | { error: string }
> {
  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };
  const { supabase } = sessao;

  // `status` explícito em vez de `insert({})`: além de documentar a intenção,
  // evita depender de como o PostgREST trata um payload vazio. `casal_id` e
  // `criado_por` continuam vindo dos defaults da 0014.
  const { data, error } = await supabase
    .from("listas_mercado")
    .insert({ status: "aberta" })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existente } = await supabase
        .from("listas_mercado")
        .select("id")
        .eq("status", "aberta")
        .maybeSingle();
      if (existente) {
        revalidar(ROTA);
        return { id: existente.id };
      }
    }
    return { error: erroAmigavel(error) };
  }

  revalidar(ROTA);
  return { id: data.id };
}

/** O que o cliente manda por item — o item inteiro, não um delta por campo. */
export type ItemParaSalvar = {
  id: string;
  nome: string;
  quantidade: string | null;
  preco: number | null;
  status: StatusItem;
  ordem: number;
};

/**
 * Descarrega a fila do cliente: um `upsert` pros itens tocados e um `delete`
 * pros removidos.
 *
 * É a única escrita do fluxo do corredor, e ela é **idempotente de
 * propósito**: os ids são gerados no cliente (`crypto.randomUUID()`), então
 * reenviar a mesma fila depois de uma falha de rede atualiza as mesmas linhas
 * em vez de duplicar itens. É isso que permite tentar de novo sem medo quando
 * o sinal volta.
 */
export async function sincronizarItens(
  listaId: string,
  itens: ItemParaSalvar[],
  remocoes: string[],
): Promise<MercadoFormState> {
  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };
  const { supabase } = sessao;

  const impedimento = await listaAberta(supabase, listaId);
  if (impedimento) return { error: impedimento };

  // Saneamento: o payload vem do cliente, então nada aqui pode ir cru pro
  // banco. Item que não passa é descartado em silêncio — derrubar o flush
  // inteiro por causa de uma linha estragada perderia as outras 29.
  const linhas = itens
    .filter(
      (i) =>
        UUID_RE.test(i.id) &&
        typeof i.nome === "string" &&
        i.nome.trim().length > 0 &&
        STATUS_VALIDOS.includes(i.status),
    )
    .map((i) => ({
      id: i.id,
      lista_id: listaId,
      nome: i.nome.trim().slice(0, 120),
      quantidade: i.quantidade?.trim().slice(0, 40) || null,
      preco:
        typeof i.preco === "number" && Number.isFinite(i.preco) && i.preco >= 0
          ? Math.round(i.preco * 100) / 100
          : null,
      status: i.status,
      ordem: Number.isInteger(i.ordem) ? i.ordem : 0,
    }));

  if (linhas.length > 0) {
    // `casal_id` e `faltou_antes` ficam de fora: o primeiro vem do default da
    // 0014, o segundo é do servidor (quem marca é o fechamento) e mandá-lo
    // daqui deixaria o cliente reescrever um selo que não é dele.
    const { error } = await supabase
      .from("itens_lista_mercado")
      .upsert(linhas, { onConflict: "id" });
    if (error) return { error: erroAmigavel(error) };
  }

  const idsParaRemover = remocoes.filter((id) => UUID_RE.test(id));
  if (idsParaRemover.length > 0) {
    const { error } = await supabase
      .from("itens_lista_mercado")
      .delete()
      .eq("lista_id", listaId)
      .in("id", idsParaRemover);
    if (error) return { error: erroAmigavel(error) };
  }

  // Sem `revalidar` de propósito. Esta action roda a cada flush da fila, e
  // revalidar aqui devolveria a página inteira do servidor a cada punhado de
  // toques — numa tela cuja razão de existir é não depender da rede. O
  // cliente já tem o estado certo; quem precisa recarregar é a volta ao foco
  // da aba, e isso a própria tela faz.
  return { ok: true };
}

const ESQUEMA_FECHAMENTO = {
  total: campo.dinheiro("Total"),
  data: campo.data("Data"),
  descricao: opcional(campo.texto("Descrição", { max: 120 })),
};

const CLASSIFICACAO = {
  cartao_id: campo.cru(),
  categoria_id: campo.cru(),
  quem_gastou: campo.cru(),
};

/**
 * Fecha a compra.
 *
 * Toda a escrita acontece dentro de `finalizar_lista_mercado()` — uma função
 * Postgres, uma transação. São quatro passos (cria a despesa, fecha a lista,
 * abre a próxima, copia o que sobrou) e nenhum deles pode acontecer sem os
 * outros: se a despesa entrasse e a lista continuasse aberta, a segunda
 * tentativa lançaria o mesmo gasto de novo.
 *
 * Aqui em cima fica só o que a função não sabe fazer: ler o formulário e
 * resolver categoria/quem-gastou, que dependem das tabelas do app.
 */
export async function finalizarCompra(
  listaId: string,
  _prev: MercadoFormState,
  formData: FormData,
): Promise<MercadoFormState> {
  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };
  const { supabase } = sessao;

  const dados = parseForm(formData, ESQUEMA_FECHAMENTO);
  if (typeof dados === "string") return { error: dados };

  const brutos = parseForm(formData, CLASSIFICACAO);
  if (typeof brutos === "string") return { error: brutos };

  const classificacao = await resolverClassificacao(
    supabase,
    brutos.categoria_id,
    brutos.quem_gastou,
  );
  if (typeof classificacao === "string") return { error: classificacao };

  const cartaoId = brutos.cartao_id.trim();
  if (cartaoId && !UUID_RE.test(cartaoId)) {
    return { error: "Cartão inválido." };
  }

  // Sem cartão a despesa é avulsa e precisa de quinzena. Com cartão ela vira
  // compra à vista na fatura, e quinzena não se aplica.
  let quinzena: number | null = null;
  if (!cartaoId) {
    const lido = parseForm(formData, {
      quinzena: campo.umDeNumero("Quinzena", [15, 30] as const),
    });
    if (typeof lido === "string") return { error: lido };
    quinzena = lido.quinzena;
  }

  const manter = formData
    .getAll("manter")
    .map(String)
    .filter((id) => UUID_RE.test(id));

  const { error } = await supabase.rpc("finalizar_lista_mercado", {
    p_lista_id: listaId,
    p_total: dados.total,
    p_data: dados.data,
    p_cartao_id: cartaoId || null,
    p_quinzena: quinzena,
    p_categoria_id: classificacao.categoria_id,
    p_categoria: classificacao.categoria,
    p_quem_gastou: classificacao.quem_gastou,
    p_descricao: dados.descricao || "Mercado",
    p_manter: manter,
  });

  if (error) {
    // As mensagens levantadas pela função já são escritas pro usuário final;
    // repassá-las cruas é melhor que traduzir de novo aqui.
    if (error.message.includes("já foi finalizada")) {
      return { error: "Esta compra já foi finalizada." };
    }
    if (error.message.includes("não encontrada")) {
      return { error: "Lista não encontrada." };
    }
    return { error: erroAmigavel(error) };
  }

  revalidar(
    ROTA,
    "/mercado/historico",
    "/despesas",
    "/relatorios/compras-do-mes",
    ...ROTAS_DO_SALDO,
  );
  return { ok: true };
}

