"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  type EstadoForm,
} from "@/lib/acoes";

export type RendaFormState = EstadoForm;

const ESQUEMA = {
  descricao: campo.texto("Descrição"),
  valor_previsto: campo.dinheiro("Valor"),
  dia_recebimento: campo.umDeNumero("Dia de recebimento", [15, 30] as const),
  ativa: campo.booleano(),
};

const ROTAS = ["/rendas", "/"];

export async function createRenda(
  _prev: RendaFormState,
  formData: FormData,
): Promise<RendaFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const { error } = await sessao.supabase.from("rendas").insert(dados);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function updateRenda(
  id: string,
  _prev: RendaFormState,
  formData: FormData,
): Promise<RendaFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const supabase = await createClient();
  const { error } = await supabase.from("rendas").update(dados).eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function deleteRenda(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rendas").delete().eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS);
}

export async function toggleRendaAtiva(id: string, ativa: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rendas")
    .update({ ativa })
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS);
}
