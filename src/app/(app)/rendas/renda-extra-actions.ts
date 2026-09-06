"use server";

import { createClient } from "@/lib/supabase/server";
import { resolverCategoria } from "@/lib/categorias-server";
import { campo, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  type EstadoForm,
  type SessaoDaAcao,
} from "@/lib/acoes";

export type RendaExtraFormState = EstadoForm;

const ESQUEMA = {
  descricao: campo.texto("Descrição"),
  valor: campo.dinheiro("Valor"),
  data: campo.data("Data"),
  quinzena: campo.umDeNumero("Quinzena", [15, 30] as const),
  categoria_id: campo.cru(),
};

const ROTAS = ["/rendas", "/"];

/** Campos do formulário no formato da tabela `lancamentos`. */
async function montarLinha(supabase: SessaoDaAcao, formData: FormData) {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return dados;

  const categoria = await resolverCategoria(supabase, dados.categoria_id);
  if (typeof categoria === "string") return categoria;

  return {
    descricao: dados.descricao,
    valor: dados.valor,
    data_pagamento: dados.data,
    // O mês de referência é sempre o dia 1 do mês da data de pagamento.
    data_referencia: `${dados.data.slice(0, 7)}-01`,
    quinzena: dados.quinzena,
    ...categoria,
  };
}

export async function createRendaExtra(
  _prev: RendaExtraFormState,
  formData: FormData,
): Promise<RendaExtraFormState> {
  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const linha = await montarLinha(sessao.supabase, formData);
  if (typeof linha === "string") return { error: linha };

  const { error } = await sessao.supabase
    .from("lancamentos")
    .insert({ tipo: "renda_extra", ...linha });
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function updateRendaExtra(
  id: string,
  _prev: RendaExtraFormState,
  formData: FormData,
): Promise<RendaExtraFormState> {
  const supabase = await createClient();

  const linha = await montarLinha(supabase, formData);
  if (typeof linha === "string") return { error: linha };

  const { error } = await supabase
    .from("lancamentos")
    .update(linha)
    .eq("id", id)
    .eq("tipo", "renda_extra");
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function deleteRendaExtra(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS);
}
