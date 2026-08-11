"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BancoFormState = { error?: string; ok?: boolean };

function parseFormData(formData: FormData):
  | { nome: string; cor: string }
  | string {
  const nome = String(formData.get("nome") ?? "").trim();
  const cor = String(formData.get("cor") ?? "").trim();

  if (!nome) return "Nome é obrigatório.";
  if (!/^#[0-9a-fA-F]{6}$/.test(cor)) return "Cor inválida.";

  return { nome, cor };
}

export async function createBanco(
  _prev: BancoFormState,
  formData: FormData,
): Promise<BancoFormState> {
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

  const { error } = await supabase.from("bancos").insert({
    casal_id: profile.casal_id,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath("/bancos");
  revalidatePath("/cartoes");
  return { ok: true };
}

export async function updateBanco(
  id: string,
  _prev: BancoFormState,
  formData: FormData,
): Promise<BancoFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase.from("bancos").update(parsed).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/bancos");
  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteBanco(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("bancos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/bancos");
  revalidatePath("/cartoes");
}
