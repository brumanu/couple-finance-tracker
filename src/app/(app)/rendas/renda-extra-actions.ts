"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";
import { resolverCategoria } from "@/lib/categorias-server";

export type RendaExtraFormState = { error?: string; ok?: boolean };

type ParsedRendaExtra = {
  descricao: string;
  valor: number;
  data_pagamento: string;
  data_referencia: string; // primeiro dia do mês da data
  quinzena: 15 | 30;
};

function parseFormData(
  formData: FormData,
): { dados: ParsedRendaExtra; categoria_id_raw: string } | string {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const categoria_id_raw = String(formData.get("categoria_id") ?? "").trim();

  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor <= 0) return "Valor deve ser maior que zero.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "Data inválida.";

  const quinzena = Number(formData.get("quinzena"));
  if (quinzena !== 15 && quinzena !== 30) return "Quinzena inválida.";
  const data_referencia = `${data.slice(0, 7)}-01`;

  return {
    categoria_id_raw,
    dados: {
      descricao,
      valor,
      data_pagamento: data,
      data_referencia,
      quinzena: quinzena as 15 | 30,
    },
  };
}

export async function createRendaExtra(
  _prev: RendaExtraFormState,
  formData: FormData,
): Promise<RendaExtraFormState> {
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

  const categoriaResolved = await resolverCategoria(
    supabase,
    parsed.categoria_id_raw,
  );
  if (typeof categoriaResolved === "string")
    return { error: categoriaResolved };

  const { error } = await supabase.from("lancamentos").insert({
    casal_id: profile.casal_id,
    tipo: "renda_extra",
    criado_por: user.id,
    ...parsed.dados,
    ...categoriaResolved,
  });
  if (error) return { error: error.message };

  revalidatePath("/rendas");
  revalidatePath("/");
  return { ok: true };
}

export async function updateRendaExtra(
  id: string,
  _prev: RendaExtraFormState,
  formData: FormData,
): Promise<RendaExtraFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const categoriaResolved = await resolverCategoria(
    supabase,
    parsed.categoria_id_raw,
  );
  if (typeof categoriaResolved === "string")
    return { error: categoriaResolved };

  const { error } = await supabase
    .from("lancamentos")
    .update({ ...parsed.dados, ...categoriaResolved })
    .eq("id", id)
    .eq("tipo", "renda_extra");
  if (error) return { error: error.message };

  revalidatePath("/rendas");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteRendaExtra(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/rendas");
  revalidatePath("/");
}
