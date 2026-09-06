"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, opcional, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  type EstadoForm,
} from "@/lib/acoes";

export type PagamentoDividaFormState = EstadoForm;

const ESQUEMA = {
  divida_id: campo.texto("Dívida"),
  valor: campo.dinheiro("Valor"),
  data_pagamento: campo.data("Data"),
  observacao: opcional(campo.texto("Observação")),
};

const rotas = (dividaId: string) => [
  `/dividas/${dividaId}`,
  "/dividas",
  "/",
];

export async function createPagamento(
  _prev: PagamentoDividaFormState,
  formData: FormData,
): Promise<PagamentoDividaFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  // `casal_id` e `criado_por` vêm dos defaults da coluna (migration 0014);
  // a trigger `assert_mesmo_casal` garante que a dívida é do casal.
  const { error } = await sessao.supabase
    .from("pagamentos_divida")
    .insert(dados);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...rotas(dados.divida_id));
  return { ok: true };
}

export async function deletePagamento(id: string, dividaId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos_divida")
    .delete()
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...rotas(dividaId));
}
