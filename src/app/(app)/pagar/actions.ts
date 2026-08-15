"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";
import { hojeISO } from "@/lib/mes";

export type PagarFormState = { error?: string; ok?: boolean };

export async function pagarContaRecorrente(
  contaRecorrenteId: string,
  dataReferencia: string, // YYYY-MM-01
  quinzena: 15 | 30,
  _prev: PagarFormState,
  formData: FormData,
): Promise<PagarFormState> {
  const valorRaw = String(formData.get("valor") ?? "").trim();
  const dataPagamento =
    String(formData.get("data_pagamento") ?? "").trim() ||
    hojeISO();
  const descricao = String(formData.get("descricao") ?? "").trim();

  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor <= 0) return { error: "Valor deve ser maior que zero." };
  if (!descricao) return { error: "Descrição obrigatória." };

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

  const { error } = await supabase.from("lancamentos").insert({
    casal_id: profile.casal_id,
    tipo: "conta_fixa",
    descricao,
    valor,
    data_referencia: dataReferencia,
    data_pagamento: dataPagamento,
    quinzena,
    conta_recorrente_id: contaRecorrenteId,
    criado_por: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/");
  return { ok: true };
}

export async function desmarcarPagamento(lancamentoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos")
    .delete()
    .eq("id", lancamentoId);
  if (error) return { error: error.message };
  revalidatePath("/");
}

/**
 * Marca uma fatura de cartão como paga. Diferente da conta fixa, aqui não
 * nasce um lançamento: o gasto já está nas compras/assinaturas do cartão, e
 * a linha em `pagamentos_fatura` só registra que a fatura foi quitada.
 */
export async function pagarFatura(
  cartaoId: string,
  mesReferencia: string, // YYYY-MM-01
  _prev: PagarFormState,
  formData: FormData,
): Promise<PagarFormState> {
  const valorRaw = String(formData.get("valor") ?? "").trim();
  const dataPagamento =
    String(formData.get("data_pagamento") ?? "").trim() || hojeISO();

  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor < 0)
    return { error: "Valor não pode ser negativo." };

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

  // upsert em vez de insert: se a fatura já estiver marcada (duas abas, ou
  // clique duplo), atualiza em vez de estourar o unique (cartao_id, mes).
  const { error } = await supabase.from("pagamentos_fatura").upsert(
    {
      casal_id: profile.casal_id,
      cartao_id: cartaoId,
      mes_referencia: mesReferencia,
      valor,
      data_pagamento: dataPagamento,
      criado_por: user.id,
    },
    { onConflict: "cartao_id,mes_referencia" },
  );

  if (error) return { error: error.message };

  revalidatePath("/");
  return { ok: true };
}

export async function desmarcarFatura(pagamentoFaturaId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos_fatura")
    .delete()
    .eq("id", pagamentoFaturaId);
  if (error) return { error: error.message };
  revalidatePath("/");
}
