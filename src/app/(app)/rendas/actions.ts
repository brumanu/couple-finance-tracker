"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type RendaFormState = {
  error?: string;
  ok?: boolean;
};

function parseFormData(formData: FormData): {
  descricao: string;
  valor_previsto: number;
  dia_recebimento: 15 | 30;
  ativa: boolean;
} | string {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor_previsto") ?? "").trim();
  const dia = Number(formData.get("dia_recebimento"));
  const ativa = formData.get("ativa") === "on" || formData.get("ativa") === "true";

  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor <= 0) return "Valor deve ser maior que zero.";
  if (dia !== 15 && dia !== 30) return "Dia de recebimento inválido.";

  return {
    descricao,
    valor_previsto: valor,
    dia_recebimento: dia as 15 | 30,
    ativa,
  };
}

export async function createRenda(
  _prev: RendaFormState,
  formData: FormData,
): Promise<RendaFormState> {
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

  const { error } = await supabase.from("rendas").insert({
    casal_id: profile.casal_id,
    ...parsed,
  });

  if (error) return { error: error.message };

  revalidatePath("/rendas");
  revalidatePath("/");
  return { ok: true };
}

export async function updateRenda(
  id: string,
  _prev: RendaFormState,
  formData: FormData,
): Promise<RendaFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase.from("rendas").update(parsed).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/rendas");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteRenda(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rendas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/rendas");
  revalidatePath("/");
}

export async function toggleRendaAtiva(id: string, ativa: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("rendas").update({ ativa }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/rendas");
  revalidatePath("/");
}
