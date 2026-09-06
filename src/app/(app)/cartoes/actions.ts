"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, opcional, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  type EstadoForm,
} from "@/lib/acoes";

export type CartaoFormState = EstadoForm;

const BANDEIRAS = ["visa", "master", "elo", "amex", "hipercard", "outra"] as const;

const ESQUEMA = {
  banco_id: campo.texto("Banco"),
  apelido: opcional(campo.texto("Apelido")),
  bandeira: opcional(campo.umDe("Bandeira", BANDEIRAS)),
  dia_fechamento: campo.inteiro("Dia de fechamento", { min: 1, max: 31 }),
  dia_vencimento: campo.inteiro("Dia de vencimento", { min: 1, max: 31 }),
  ativo: campo.booleano(),
};

export async function createCartao(
  _prev: CartaoFormState,
  formData: FormData,
): Promise<CartaoFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const { error } = await sessao.supabase.from("cartoes").insert(dados);
  if (error) return { error: erroAmigavel(error) };

  revalidar("/cartoes", "/");
  return { ok: true };
}

export async function updateCartao(
  id: string,
  _prev: CartaoFormState,
  formData: FormData,
): Promise<CartaoFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const supabase = await createClient();
  const { error } = await supabase.from("cartoes").update(dados).eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar("/cartoes", `/cartoes/${id}`, "/");
  return { ok: true };
}

export async function deleteCartao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cartoes").delete().eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar("/cartoes", "/");
}

export async function toggleCartaoAtivo(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cartoes")
    .update({ ativo })
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar("/cartoes", "/");
}
