"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type DespesaFormState = { error?: string; ok?: boolean };

type ParsedDespesa = {
  descricao: string;
  valor: number;
  data_pagamento: string;
  data_referencia: string; // primeiro dia do mês da data
  quinzena: 15 | 30;
  categoria: string | null;
};

type ParsedCompra = {
  cartao_id: string;
  descricao: string;
  valor: number;
  data_compra: string;
  parcelas: number;
  categoria: string | null;
};

type ParsedInput =
  | { tipo: "despesa"; dados: ParsedDespesa }
  | { tipo: "compra_cartao"; dados: ParsedCompra };

function parseFormData(formData: FormData): ParsedInput | string {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const cartao_id = String(formData.get("cartao_id") ?? "").trim();

  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor < 0) return "Valor inválido.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "Data inválida.";

  // Vinculado a cartão → compra à vista (parcelas=1) OU parcelada
  if (cartao_id) {
    const parcelasRaw = Number(formData.get("parcelas") ?? 1);
    const parcelas =
      Number.isInteger(parcelasRaw) && parcelasRaw >= 1 && parcelasRaw <= 60
        ? parcelasRaw
        : 1;
    return {
      tipo: "compra_cartao",
      dados: {
        cartao_id,
        descricao,
        valor,
        data_compra: data,
        parcelas,
        categoria,
      },
    };
  }

  // Despesa avulsa clássica
  const quinzena = Number(formData.get("quinzena"));
  if (quinzena !== 15 && quinzena !== 30) return "Quinzena inválida.";
  const data_referencia = `${data.slice(0, 7)}-01`;

  return {
    tipo: "despesa",
    dados: {
      descricao,
      valor,
      data_pagamento: data,
      data_referencia,
      quinzena: quinzena as 15 | 30,
      categoria,
    },
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

  if (parsed.tipo === "compra_cartao") {
    const { error } = await supabase.from("compras_cartao").insert({
      casal_id: profile.casal_id,
      criado_por: user.id,
      cartao_id: parsed.dados.cartao_id,
      descricao: parsed.dados.descricao,
      valor_total: parsed.dados.valor,
      data_compra: parsed.dados.data_compra,
      parcelas: parsed.dados.parcelas,
      parcelas_ja_pagas: 0,
      categoria: parsed.dados.categoria,
    });
    if (error) return { error: error.message };

    revalidatePath("/despesas");
    revalidatePath("/cartoes");
    revalidatePath(`/cartoes/${parsed.dados.cartao_id}`);
    revalidatePath("/");
    return { ok: true };
  }

  const { error } = await supabase.from("lancamentos").insert({
    casal_id: profile.casal_id,
    tipo: "despesa_avulsa",
    criado_por: user.id,
    ...parsed.dados,
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
  // Edição de despesa avulsa não permite trocar pra cartão (nem vice-versa)
  // — o registro está numa tabela diferente. Se precisar, exclui e cadastra
  // de novo. Aqui a gente só suporta ajustar campos da despesa.
  if (parsed.tipo !== "despesa")
    return {
      error:
        "Pra virar uma compra no cartão, exclua e cadastre de novo escolhendo o cartão.",
    };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos")
    .update(parsed.dados)
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
