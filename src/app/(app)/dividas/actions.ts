"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  type EstadoForm,
} from "@/lib/acoes";

export type DividaFormState = EstadoForm;

const ESQUEMA = {
  descricao: campo.texto("Descrição"),
  valor_total: campo.dinheiro("Valor total"),
};

export async function createDivida(
  _prev: DividaFormState,
  formData: FormData,
): Promise<DividaFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const { error } = await sessao.supabase.from("dividas").insert(dados);
  if (error) return { error: erroAmigavel(error) };

  revalidar("/dividas", "/");
  return { ok: true };
}

export async function updateDivida(
  id: string,
  _prev: DividaFormState,
  formData: FormData,
): Promise<DividaFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const supabase = await createClient();
  const { error } = await supabase.from("dividas").update(dados).eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar("/dividas", `/dividas/${id}`, "/");
  return { ok: true };
}

export async function deleteDivida(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("dividas").delete().eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar("/dividas", "/");
}
