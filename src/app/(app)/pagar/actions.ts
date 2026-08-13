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
