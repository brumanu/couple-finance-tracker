"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";
import { hojeISO } from "@/lib/mes";
import { resolverCategoria } from "@/lib/categorias-server";
import { resolverQuemGastou } from "@/lib/membros-server";

export type CompraFuturaFormState = { error?: string; ok?: boolean };

const ROTA = "/compras-futuras";

type ParsedCompraFutura = {
  descricao: string;
  valor_estimado: number | null;
  prioridade: 1 | 2 | 3;
  link: string | null;
  observacao: string | null;
};

function parseFormData(
  formData: FormData,
): { dados: ParsedCompraFutura; categoria_raw: string; quem_raw: string } | string {
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (!descricao) return "Descrição é obrigatória.";

  // Valor é opcional aqui — o item pode entrar na lista sem preço. Só
  // rejeita se veio preenchido e não dá pra ler.
  const valorRaw = String(formData.get("valor_estimado") ?? "").trim();
  let valor_estimado: number | null = null;
  if (valorRaw) {
    const n = parseBRLInput(valorRaw);
    if (n === null || n < 0) return "Valor estimado inválido.";
    valor_estimado = n;
  }

  const prioridadeRaw = Number(formData.get("prioridade") ?? 2);
  const prioridade = ([1, 2, 3] as const).includes(
    prioridadeRaw as 1 | 2 | 3,
  )
    ? (prioridadeRaw as 1 | 2 | 3)
    : 2;

  const link = String(formData.get("link") ?? "").trim() || null;
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  return {
    dados: { descricao, valor_estimado, prioridade, link, observacao },
    categoria_raw: String(formData.get("categoria_id") ?? "").trim(),
    quem_raw: String(formData.get("quem_gastou") ?? "").trim(),
  };
}

export async function createCompraFutura(
  _prev: CompraFuturaFormState,
  formData: FormData,
): Promise<CompraFuturaFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("casal_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Profile não encontrado." };

  const categoria = await resolverCategoria(supabase, parsed.categoria_raw);
  if (typeof categoria === "string") return { error: categoria };

  const quem = await resolverQuemGastou(supabase, parsed.quem_raw);
  if (typeof quem === "string") return { error: quem };

  const { error } = await supabase.from("compras_futuras").insert({
    casal_id: profile.casal_id,
    criado_por: user.id,
    ...parsed.dados,
    ...categoria,
    quem_quer: quem.quem_gastou,
  });
  if (error) return { error: error.message };

  revalidatePath(ROTA);
  return { ok: true };
}

export async function updateCompraFutura(
  id: string,
  _prev: CompraFuturaFormState,
  formData: FormData,
): Promise<CompraFuturaFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();

  const categoria = await resolverCategoria(supabase, parsed.categoria_raw);
  if (typeof categoria === "string") return { error: categoria };

  const quem = await resolverQuemGastou(supabase, parsed.quem_raw);
  if (typeof quem === "string") return { error: quem };

  const { error } = await supabase
    .from("compras_futuras")
    .update({
      ...parsed.dados,
      ...categoria,
      quem_quer: quem.quem_gastou,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(ROTA);
  return { ok: true };
}

export async function deleteCompraFutura(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compras_futuras")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(ROTA);
}

/** Volta o item pra lista de desejos (desfaz o "comprei"). */
export async function reabrirCompraFutura(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compras_futuras")
    .update({ comprado_em: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(ROTA);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCompra))
    return { error: "Data inválida." };

  const lancarDespesa = formData.get("lancar_despesa") != null;
  const valorRaw = String(formData.get("valor") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: item } = await supabase
    .from("compras_futuras")
    .select("id, casal_id, descricao, categoria, categoria_id, quem_quer")
    .eq("id", id)
    .maybeSingle();
  if (!item) return { error: "Item não encontrado." };

  if (lancarDespesa) {
    const valor = parseBRLInput(valorRaw);
    if (valor === null || valor <= 0)
      return { error: "Pra lançar a despesa, informe um valor maior que zero." };

    const dia = Number(dataCompra.slice(8, 10));
    const { error: erroDespesa } = await supabase.from("lancamentos").insert({
      casal_id: item.casal_id,
      tipo: "despesa_avulsa",
      criado_por: user.id,
      descricao: item.descricao,
      valor,
      data_pagamento: dataCompra,
      data_referencia: `${dataCompra.slice(0, 7)}-01`,
      quinzena: dia <= 15 ? 15 : 30,
      categoria: item.categoria,
      categoria_id: item.categoria_id,
      quem_gastou: item.quem_quer,
    });
    if (erroDespesa) return { error: erroDespesa.message };
  }

  const { error } = await supabase
    .from("compras_futuras")
    .update({ comprado_em: dataCompra })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(ROTA);
  if (lancarDespesa) {
    revalidatePath("/despesas");
    revalidatePath("/relatorios/compras-do-mes");
    revalidatePath("/");
  }
  return { ok: true };
}
