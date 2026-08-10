"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type DespesaFormState = { error?: string; ok?: boolean };

type Parsed = {
  descricao: string;
  valor: number;
  data_pagamento: string;
  data_referencia: string; // primeiro dia do mês da data
  quinzena: 15 | 30;
  categoria: string | null;
};

function parseFormData(formData: FormData): Parsed | string {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const quinzena = Number(formData.get("quinzena"));
  const categoria = String(formData.get("categoria") ?? "").trim() || null;

  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor < 0) return "Valor inválido.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "Data inválida.";
  if (quinzena !== 15 && quinzena !== 30) return "Quinzena inválida.";

  const data_referencia = `${data.slice(0, 7)}-01`;

  return {
    descricao,
    valor,
    data_pagamento: data,
    data_referencia,
    quinzena: quinzena as 15 | 30,
    categoria,
  };
}

export async function createDespesa(
  _prev: DespesaFormState,
  formData: FormData,
): Promise<DespesaFormState> {
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

  const { error } = await supabase.from("lancamentos").insert({
    casal_id: profile.casal_id,
    tipo: "despesa_avulsa",
    criado_por: user.id,
    ...parsed,
  });

  if (error) return { error: error.message };

  revalidatePath("/despesas");
  revalidatePath("/");
  return { ok: true };
}

export async function updateDespesa(
  id: string,
  _prev: DespesaFormState,
  formData: FormData,
): Promise<DespesaFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos")
    .update(parsed)
    .eq("id", id)
    .eq("tipo", "despesa_avulsa");
  if (error) return { error: error.message };

  revalidatePath("/despesas");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDespesa(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/despesas");
  revalidatePath("/");
}
