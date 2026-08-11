"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type AssinaturaFormState = { error?: string; ok?: boolean };

type Parsed = {
  cartao_id: string;
  descricao: string;
  valor_mensal: number;
  categoria: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
};

function parseFormData(formData: FormData): Parsed | string {
  const cartao_id = String(formData.get("cartao_id") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor_mensal") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const inicio_vigencia =
    String(formData.get("inicio_vigencia") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const fimRaw = String(formData.get("fim_vigencia") ?? "").trim();
  const fim_vigencia = fimRaw || null;
  const ativa =
    formData.get("ativa") === "on" || formData.get("ativa") === "true";

  if (!cartao_id) return "Cartão inválido.";
  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor < 0) return "Valor mensal inválido.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio_vigencia))
    return "Data de início inválida.";
  if (fim_vigencia && !/^\d{4}-\d{2}-\d{2}$/.test(fim_vigencia))
    return "Data de fim inválida.";
  if (fim_vigencia && fim_vigencia < inicio_vigencia)
    return "Data de fim deve ser depois da de início.";

  return {
    cartao_id,
    descricao,
    valor_mensal: valor,
    categoria,
    inicio_vigencia,
    fim_vigencia,
    ativa,
  };
}

export async function createAssinatura(
  _prev: AssinaturaFormState,
  formData: FormData,
): Promise<AssinaturaFormState> {
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

  const { error } = await supabase.from("assinaturas_cartao").insert({
    casal_id: profile.casal_id,
    criada_por: user.id,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/cartoes/${parsed.cartao_id}`);
  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

export async function updateAssinatura(
  id: string,
  _prev: AssinaturaFormState,
  formData: FormData,
): Promise<AssinaturaFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("assinaturas_cartao")
    .update(parsed)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/cartoes/${parsed.cartao_id}`);
  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAssinatura(id: string, cartaoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assinaturas_cartao")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/cartoes/${cartaoId}`);
  revalidatePath("/cartoes");
  revalidatePath("/");
}

export async function toggleAssinaturaAtiva(
  id: string,
  cartaoId: string,
  ativa: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assinaturas_cartao")
    .update({ ativa })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/cartoes/${cartaoId}`);
  revalidatePath("/cartoes");
  revalidatePath("/");
}

/** Encerra a assinatura setando fim_vigencia como hoje. */
export async function cancelarAssinatura(id: string, cartaoId: string) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("assinaturas_cartao")
    .update({ fim_vigencia: hoje })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/cartoes/${cartaoId}`);
  revalidatePath("/cartoes");
  revalidatePath("/");
}
