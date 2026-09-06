"use server";

import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/mes";
import { campo, opcional, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  resolverClassificacao,
  revalidar,
  type EstadoForm,
  type SessaoDaAcao,
} from "@/lib/acoes";

export type CompraFuturaFormState = EstadoForm;

const ROTA = "/compras-futuras";

const ESQUEMA = {
  descricao: campo.texto("Descrição"),
  // O item pode entrar na lista sem preço — só recusa se veio ilegível.
  valor_estimado: opcional(
    campo.dinheiro("Valor estimado", { permiteZero: true }),
  ),
  // Prioridade fora da faixa cai pra "média" em vez de recusar: o campo é um
  // select de três opções, então valor estranho aqui é ruído, não intenção.
  prioridade: campo.customizado((bruto) => {
    const n = Number(bruto || 2);
    return { valor: n === 1 || n === 3 ? n : 2 };
  }),
  // Só http(s): um link "javascript:…" executaria script na sessão de quem
  // clicasse na lista.
  link: opcional(campo.url("Link")),
  observacao: opcional(campo.texto("Observação")),
};

const CLASSIFICACAO = {
  categoria_id: campo.cru(),
  quem_gastou: campo.cru(),
};

async function montarLinha(supabase: SessaoDaAcao, formData: FormData) {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return dados;

  const brutos = parseForm(formData, CLASSIFICACAO);
  if (typeof brutos === "string") return brutos;

  const classificacao = await resolverClassificacao(
    supabase,
    brutos.categoria_id,
    brutos.quem_gastou,
  );
  if (typeof classificacao === "string") return classificacao;

  const { quem_gastou, ...resto } = classificacao;
  // Nesta tabela a coluna se chama `quem_quer` — é um desejo, não um gasto.
  return { ...dados, ...resto, quem_quer: quem_gastou };
}

export async function createCompraFutura(
  _prev: CompraFuturaFormState,
  formData: FormData,
): Promise<CompraFuturaFormState> {
  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const linha = await montarLinha(sessao.supabase, formData);
  if (typeof linha === "string") return { error: linha };

  const { error } = await sessao.supabase
    .from("compras_futuras")
    .insert(linha);
  if (error) return { error: erroAmigavel(error) };

  revalidar(ROTA);
  return { ok: true };
}

export async function updateCompraFutura(
  id: string,
  _prev: CompraFuturaFormState,
  formData: FormData,
): Promise<CompraFuturaFormState> {
  const supabase = await createClient();

  const linha = await montarLinha(supabase, formData);
  if (typeof linha === "string") return { error: linha };

  const { error } = await supabase
    .from("compras_futuras")
    .update(linha)
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar(ROTA);
  return { ok: true };
}

export async function deleteCompraFutura(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compras_futuras")
    .delete()
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(ROTA);
}

/** Volta o item pra lista de desejos (desfaz o "comprei"). */
export async function reabrirCompraFutura(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compras_futuras")
    .update({ comprado_em: null })
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(ROTA);
}

/**
 * Marca o item como comprado. Se `lancar_despesa` vier marcado, também cria
 * a despesa avulsa correspondente — é o pulo do gato da tela: o desejo vira
 * gasto de verdade sem redigitar nada.
 */
export async function marcarComprada(
  id: string,
  _prev: CompraFuturaFormState,
  formData: FormData,
): Promise<CompraFuturaFormState> {
  const dataCompra =
    String(formData.get("data_compra") ?? "").trim() || hojeISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCompra)) {
    return { error: "Data inválida." };
  }

  const lancarDespesa = formData.get("lancar_despesa") != null;

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };
  const { supabase } = sessao;

  const { data: item } = await supabase
    .from("compras_futuras")
    .select("id, descricao, categoria, categoria_id, quem_quer")
    .eq("id", id)
    .maybeSingle();
  if (!item) return { error: "Item não encontrado." };

  if (lancarDespesa) {
    const valor = parseForm(formData, {
      valor: campo.dinheiro("Valor"),
    });
    if (typeof valor === "string") {
      return {
        error: "Pra lançar a despesa, informe um valor maior que zero.",
      };
    }

    const dia = Number(dataCompra.slice(8, 10));
    const { error: erroDespesa } = await supabase.from("lancamentos").insert({
      tipo: "despesa_avulsa",
      descricao: item.descricao,
      valor: valor.valor,
      data_pagamento: dataCompra,
      data_referencia: `${dataCompra.slice(0, 7)}-01`,
      quinzena: dia <= 15 ? 15 : 30,
      categoria: item.categoria,
      categoria_id: item.categoria_id,
      quem_gastou: item.quem_quer,
    });
    if (erroDespesa) return { error: erroAmigavel(erroDespesa) };
  }

  const { error } = await supabase
    .from("compras_futuras")
    .update({ comprado_em: dataCompra })
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar(ROTA);
  if (lancarDespesa) {
    revalidar("/despesas", "/relatorios/compras-do-mes", "/");
  }
  return { ok: true };
}
