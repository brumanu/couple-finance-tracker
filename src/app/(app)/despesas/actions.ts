"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";
import { resolverCategoria } from "@/lib/categorias-server";

export type DespesaFormState = { error?: string; ok?: boolean };

type ParsedDespesa = {
  descricao: string;
  valor: number;
  data_pagamento: string;
  data_referencia: string; // primeiro dia do mês da data
  quinzena: 15 | 30;
};

type ParsedCompra = {
  cartao_id: string;
  descricao: string;
  valor: number;
  data_compra: string;
  parcelas: number;
};

type ParsedInput =
  | { tipo: "despesa"; dados: ParsedDespesa; categoria_id_raw: string }
  | { tipo: "compra_cartao"; dados: ParsedCompra; categoria_id_raw: string };

function parseFormData(formData: FormData): ParsedInput | string {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const valorRaw = String(formData.get("valor") ?? "").trim();
  const data = String(formData.get("data") ?? "").trim();
  const categoria_id_raw = String(formData.get("categoria_id") ?? "").trim();
  const cartao_id = String(formData.get("cartao_id") ?? "").trim();

  if (!descricao) return "Descrição é obrigatória.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor <= 0) return "Valor deve ser maior que zero.";
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
      categoria_id_raw,
      dados: {
        cartao_id,
        descricao,
        valor,
        data_compra: data,
        parcelas,
      },
    };
  }

  // Despesa avulsa clássica
  const quinzena = Number(formData.get("quinzena"));
  if (quinzena !== 15 && quinzena !== 30) return "Quinzena inválida.";
  const data_referencia = `${data.slice(0, 7)}-01`;

  return {
    tipo: "despesa",
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

  const categoriaResolved = await resolverCategoria(
    supabase,
    parsed.categoria_id_raw,
  );
  if (typeof categoriaResolved === "string")
    return { error: categoriaResolved };

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
      ...categoriaResolved,
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
    ...categoriaResolved,
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
    .eq("tipo", "despesa_avulsa");
  if (error) return { error: error.message };

  revalidatePath("/despesas");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDespesa(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/despesas");
  revalidatePath("/");
}
