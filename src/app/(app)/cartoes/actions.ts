"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CartaoFormState = { error?: string; ok?: boolean };

type ParsedCartao = {
  banco_id: string;
  apelido: string | null;
  bandeira: string | null;
  dia_fechamento: number;
  dia_vencimento: number;
  ativo: boolean;
};

function parseFormData(formData: FormData): ParsedCartao | string {
  const banco_id = String(formData.get("banco_id") ?? "").trim();
  const apelido = String(formData.get("apelido") ?? "").trim() || null;
  const bandeira = String(formData.get("bandeira") ?? "").trim() || null;
  const dia_fechamento = Number(formData.get("dia_fechamento"));
  const dia_vencimento = Number(formData.get("dia_vencimento"));
  const ativo =
    formData.get("ativo") === "on" || formData.get("ativo") === "true";

  if (!banco_id) return "Selecione o banco.";
  if (
    !Number.isInteger(dia_fechamento) ||
    dia_fechamento < 1 ||
    dia_fechamento > 31
  )
    return "Dia de fechamento inválido.";
  if (
    !Number.isInteger(dia_vencimento) ||
    dia_vencimento < 1 ||
    dia_vencimento > 31
  )
    return "Dia de vencimento inválido.";
  if (
    bandeira &&
    !["visa", "master", "elo", "amex", "hipercard", "outra"].includes(bandeira)
  )
    return "Bandeira inválida.";

  return {
    banco_id,
    apelido,
    bandeira,
    dia_fechamento,
    dia_vencimento,
    ativo,
  };
}

export async function createCartao(
  _prev: CartaoFormState,
  formData: FormData,
): Promise<CartaoFormState> {
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

  const { error } = await supabase.from("cartoes").insert({
    casal_id: profile.casal_id,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

export async function updateCartao(
  id: string,
  _prev: CartaoFormState,
  formData: FormData,
): Promise<CartaoFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase.from("cartoes").update(parsed).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/cartoes");
  revalidatePath(`/cartoes/${id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCartao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cartoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cartoes");
  revalidatePath("/");
}

export async function toggleCartaoAtivo(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cartoes")
    .update({ ativo })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/cartoes");
  revalidatePath("/");
}
