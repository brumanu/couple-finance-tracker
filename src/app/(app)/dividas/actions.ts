"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type DividaFormState = { error?: string; ok?: boolean };

function parseFormData(formData: FormData):
  | { descricao: string; valor_total: number }
  | string {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor_total") ?? "").trim();

  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor <= 0)
    return "O valor total precisa ser maior que zero.";

  return { descricao, valor_total: valor };
}

export async function createDivida(
  _prev: DividaFormState,
  formData: FormData,
): Promise<DividaFormState> {
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

  const { error } = await supabase.from("dividas").insert({
    casal_id: profile.casal_id,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath("/dividas");
  revalidatePath("/");
  return { ok: true };
}

export async function updateDivida(
  id: string,
  _prev: DividaFormState,
  formData: FormData,
): Promise<DividaFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase.from("dividas").update(parsed).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dividas");
  revalidatePath(`/dividas/${id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDivida(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("dividas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dividas");
  revalidatePath("/");
}
