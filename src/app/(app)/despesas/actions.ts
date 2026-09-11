"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { campo, parseForm } from "@/lib/parse-form";
import { avisarCompra } from "@/lib/push/aviso-compra-server";
import type { CompraLancada } from "@/lib/push/aviso-compra";
import {
  clienteAutenticado,
  erroAmigavel,
  lerCategoriasExtras,
  resolverClassificacao,
  revalidar,
  sincronizarCategoriasExtras,
  type EstadoForm,
} from "@/lib/acoes";

export type DespesaFormState = EstadoForm;

/** Campos que os dois caminhos (despesa avulsa e compra no cartão) usam. */
const COMUM = {
  descricao: campo.texto("Descrição"),
  valor: campo.dinheiro("Valor"),
  data: campo.data("Data"),
  cartao_id: campo.cru(),
  categoria_id: campo.cru(),
  quem_gastou: campo.cru(),
};

const ROTAS_DESPESA = ["/despesas", "/relatorios/compras-do-mes", "/"];

// `aviso` é o que o push pro outro precisa (ver `avisarCompra`).
type Entrada =
  | {
      tipo: "compra_cartao";
      cartaoId: string;
      linha: Record<string, unknown>;
      aviso: CompraLancada;
    }
  | { tipo: "despesa"; linha: Record<string, unknown>; aviso: CompraLancada };

/**
 * Lê o formulário e decide em qual tabela a linha vai cair.
 *
 * Com cartão escolhido, o lançamento vira `compras_cartao` (à vista é
 * `parcelas = 1`). Sem cartão, é uma `lancamentos` do tipo `despesa_avulsa`.
 */
function lerFormulario(formData: FormData): Entrada | string {
  const dados = parseForm(formData, COMUM);
  if (typeof dados === "string") return dados;

  if (dados.cartao_id) {
    // Parcelas fora da faixa caem pra 1 em vez de recusar o formulário: o
    // campo só aparece com o checkbox "foi parcelada" marcado, então um valor
    // estranho aqui é ruído, não intenção.
    const parcelasBrutas = Number(formData.get("parcelas") ?? 1);
    const parcelas =
      Number.isInteger(parcelasBrutas) &&
      parcelasBrutas >= 1 &&
      parcelasBrutas <= 60
        ? parcelasBrutas
        : 1;

    return {
      tipo: "compra_cartao",
      cartaoId: dados.cartao_id,
      linha: {
        cartao_id: dados.cartao_id,
        descricao: dados.descricao,
        valor_total: dados.valor,
        data_compra: dados.data,
        parcelas,
        parcelas_ja_pagas: 0,
      },
      aviso: {
        tipo: "cartao",
        cartaoId: dados.cartao_id,
        descricao: dados.descricao,
        valor: dados.valor,
      },
    };
  }

  const quinzena = parseForm(formData, {
    quinzena: campo.umDeNumero("Quinzena", [15, 30] as const),
  });
  if (typeof quinzena === "string") return quinzena;

  return {
    tipo: "despesa",
    linha: {
      descricao: dados.descricao,
      valor: dados.valor,
      data_pagamento: dados.data,
      // O mês de referência é sempre o dia 1 do mês da data de pagamento.
      data_referencia: `${dados.data.slice(0, 7)}-01`,
      quinzena: quinzena.quinzena,
    },
    aviso: { tipo: "despesa", descricao: dados.descricao, valor: dados.valor },
  };
}

export async function createDespesa(
  _prev: DespesaFormState,
  formData: FormData,
): Promise<DespesaFormState> {
  const entrada = lerFormulario(formData);
  if (typeof entrada === "string") return { error: entrada };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };
  const { supabase } = sessao;
  const avisarOOutro = () =>
    after(() => avisarCompra(supabase, sessao.userId, entrada.aviso));

  const classificacao = await resolverClassificacao(
    supabase,
    String(formData.get("categoria_id") ?? ""),
    String(formData.get("quem_gastou") ?? ""),
  );
  if (typeof classificacao === "string") return { error: classificacao };

  const extras = lerCategoriasExtras(formData, classificacao.categoria_id);

  // `casal_id` e `criado_por` vêm dos defaults da coluna (migration 0014).
  // O `select("id")` é o que permite gravar as extras logo em seguida: elas
  // moram noutra tabela e precisam do id recém-gerado.
  if (entrada.tipo === "compra_cartao") {
    const { data, error } = await supabase
      .from("compras_cartao")
      .insert({ ...entrada.linha, ...classificacao })
      .select("id")
      .single();
    if (error) return { error: erroAmigavel(error) };

    const erroExtras = await sincronizarCategoriasExtras(
      supabase,
      { compra_cartao_id: data.id },
      extras,
    );
    if (erroExtras) return { error: erroExtras };

    revalidar(
      ...ROTAS_DESPESA,
      "/cartoes",
      `/cartoes/${entrada.cartaoId}`,
    );
    avisarOOutro();
    return { ok: true };
  }

  const { data, error } = await supabase
    .from("lancamentos")
    .insert({ tipo: "despesa_avulsa", ...entrada.linha, ...classificacao })
    .select("id")
    .single();
  if (error) return { error: erroAmigavel(error) };

  const erroExtras = await sincronizarCategoriasExtras(
    supabase,
    { lancamento_id: data.id },
    extras,
  );
  if (erroExtras) return { error: erroExtras };

  revalidar(...ROTAS_DESPESA);
  avisarOOutro();
  return { ok: true };
}

export async function updateDespesa(
  id: string,
  _prev: DespesaFormState,
  formData: FormData,
): Promise<DespesaFormState> {
  const entrada = lerFormulario(formData);
  if (typeof entrada === "string") return { error: entrada };

  // Editar não pode migrar de tabela: a despesa avulsa mora em `lancamentos`
  // e a compra no cartão em `compras_cartao`. Pra trocar, exclui e cadastra.
  if (entrada.tipo !== "despesa") {
    return {
      error:
        "Pra virar uma compra no cartão, exclua e cadastre de novo escolhendo o cartão.",
    };
  }

  const supabase = await createClient();
  const classificacao = await resolverClassificacao(
    supabase,
    String(formData.get("categoria_id") ?? ""),
    String(formData.get("quem_gastou") ?? ""),
  );
  if (typeof classificacao === "string") return { error: classificacao };

  const { error } = await supabase
    .from("lancamentos")
    .update({ ...entrada.linha, ...classificacao })
    .eq("id", id)
    .eq("tipo", "despesa_avulsa");
  if (error) return { error: erroAmigavel(error) };

  const erroExtras = await sincronizarCategoriasExtras(
    supabase,
    { lancamento_id: id },
    lerCategoriasExtras(formData, classificacao.categoria_id),
  );
  if (erroExtras) return { error: erroExtras };

  revalidar(...ROTAS_DESPESA);
  return { ok: true };
}

export async function deleteDespesa(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS_DESPESA);
}
