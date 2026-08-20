"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type NotaMeiFormState = { error?: string; ok?: boolean };

const ROTA = "/faturamento-mei";

type ParsedNota = {
  empresa: string;
  valor: number;
  data_emissao: string;
};

function parseFormData(formData: FormData): ParsedNota | string {
  const empresa = String(formData.get("empresa") ?? "").trim();
  if (!empresa) return "Nome da empresa é obrigatório.";

  const valor = parseBRLInput(String(formData.get("valor") ?? "").trim());
  if (valor === null || valor <= 0) return "Valor deve ser maior que zero.";

  const data_emissao = String(formData.get("data_emissao") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_emissao))
    return "Data de emissão inválida.";

  return { empresa, valor, data_emissao };
}

export async function createNotaMei(
  _prev: NotaMeiFormState,
  formData: FormData,
): Promise<NotaMeiFormState> {
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

  const { error } = await supabase.from("notas_mei").insert({
    casal_id: profile.casal_id,
    criado_por: user.id,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath(ROTA);
  return { ok: true };
}

export async function updateNotaMei(
  id: string,
  _prev: NotaMeiFormState,
  formData: FormData,
): Promise<NotaMeiFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notas_mei")
    .update(parsed)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(ROTA);
  return { ok: true };
}

export async function deleteNotaMei(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notas_mei").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(ROTA);
}
