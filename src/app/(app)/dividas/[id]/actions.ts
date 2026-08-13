"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseBRLInput } from "@/lib/format";

export type PagamentoDividaFormState = { error?: string; ok?: boolean };

type Parsed = {
  divida_id: string;
  valor: number;
  data_pagamento: string;
  observacao: string | null;
};

function parseFormData(formData: FormData): Parsed | string {
  const divida_id = String(formData.get("divida_id") ?? "").trim();
  const valorRaw = String(formData.get("valor") ?? "").trim();
  const data_pagamento = String(formData.get("data_pagamento") ?? "").trim();
  const observacao =
    String(formData.get("observacao") ?? "").trim() || null;

  if (!divida_id) return "Dívida inválida.";
  const valor = parseBRLInput(valorRaw);
  if (valor === null || valor <= 0)
    return "O valor precisa ser maior que zero.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_pagamento)) return "Data inválida.";

  return { divida_id, valor, data_pagamento, observacao };
}

export async function createPagamento(
  _prev: PagamentoDividaFormState,
  formData: FormData,
): Promise<PagamentoDividaFormState> {
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

  const { error } = await supabase.from("pagamentos_divida").insert({
    casal_id: profile.casal_id,
    criado_por: user.id,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath(`/dividas/${parsed.divida_id}`);
  revalidatePath("/dividas");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePagamento(id: string, dividaId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos_divida")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/dividas/${dividaId}`);
  revalidatePath("/dividas");
  revalidatePath("/");
}
