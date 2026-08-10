"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type RecorrenteFormState = {
  error?: string;
  ok?: boolean;
};

type Parsed = {
  descricao: string;
  valor_previsto: number;
  quinzena: 15 | 30;
  dia_vencimento: number | null;
  categoria: string | null;
  ativa: boolean;
};

function parseFormData(formData: FormData): Parsed | string {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor_previsto") ?? "").trim();
  const quinzena = Number(formData.get("quinzena"));
  const diaVencRaw = String(formData.get("dia_vencimento") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const ativa =
    formData.get("ativa") === "on" || formData.get("ativa") === "true";

  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor < 0) return "Valor inválido.";
  if (quinzena !== 15 && quinzena !== 30) return "Quinzena inválida.";

  let dia_vencimento: number | null = null;
  if (diaVencRaw) {
    const d = Number(diaVencRaw);
    if (!Number.isInteger(d) || d < 1 || d > 31)
      return "Dia de vencimento inválido.";
    dia_vencimento = d;
  }

  return {
    descricao,
    valor_previsto: valor,
    quinzena: quinzena as 15 | 30,
    dia_vencimento,
    categoria,
    ativa,
  };
}

export async function createRecorrente(
  _prev: RecorrenteFormState,
  formData: FormData,
): Promise<RecorrenteFormState> {
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

  const { error } = await supabase.from("contas_recorrentes").insert({
    casal_id: profile.casal_id,
    ...parsed,
  });

  if (error) return { error: error.message };

  revalidatePath("/recorrentes");
  revalidatePath("/");
  return { ok: true };
}

export async function updateRecorrente(
  id: string,
  _prev: RecorrenteFormState,
  formData: FormData,
): Promise<RecorrenteFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("contas_recorrentes")
    .update(parsed)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/recorrentes");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteRecorrente(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contas_recorrentes")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/recorrentes");
  revalidatePath("/");
}

export async function toggleRecorrenteAtiva(id: string, ativa: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contas_recorrentes")
    .update({ ativa })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/recorrentes");
  revalidatePath("/");
}
