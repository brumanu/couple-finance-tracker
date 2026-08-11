"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type CompraFormState = { error?: string; ok?: boolean };

type Parsed = {
  cartao_id: string;
  descricao: string;
  valor_total: number;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number;
  categoria: string | null;
};

function parseFormData(formData: FormData): Parsed | string {
  const cartao_id = String(formData.get("cartao_id") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor_total") ?? "").trim();
  const data_compra = String(formData.get("data_compra") ?? "").trim();
  const parcelas = Number(formData.get("parcelas"));
  const emAndamento =
    formData.get("em_andamento") === "on" ||
    formData.get("em_andamento") === "true";
  const parcelaAtualRaw = formData.get("parcela_atual");
  const parcela_atual =
    emAndamento && parcelaAtualRaw ? Number(parcelaAtualRaw) : 1;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;

  if (!cartao_id) return "Cartão inválido.";
  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor < 0) return "Valor inválido.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_compra)) return "Data inválida.";
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 60)
    return "Parcelas inválidas (1 a 60).";
  if (
    emAndamento &&
    (!Number.isInteger(parcela_atual) ||
      parcela_atual < 1 ||
      parcela_atual > parcelas)
  )
    return `Parcela atual deve estar entre 1 e ${parcelas}.`;

  const parcelas_ja_pagas = emAndamento ? parcela_atual - 1 : 0;

  return {
    cartao_id,
    descricao,
    valor_total: valor,
    data_compra,
    parcelas,
    parcelas_ja_pagas,
    categoria,
  };
}

export async function createCompra(
  _prev: CompraFormState,
  formData: FormData,
): Promise<CompraFormState> {
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

  const { error } = await supabase.from("compras_cartao").insert({
    casal_id: profile.casal_id,
    criado_por: user.id,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/cartoes/${parsed.cartao_id}`);
  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

export async function updateCompra(
  id: string,
  _prev: CompraFormState,
  formData: FormData,
): Promise<CompraFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("compras_cartao")
    .update(parsed)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/cartoes/${parsed.cartao_id}`);
  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCompra(id: string, cartaoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compras_cartao")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/cartoes/${cartaoId}`);
  revalidatePath("/cartoes");
  revalidatePath("/");
}
