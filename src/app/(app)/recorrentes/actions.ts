"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, opcional, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  resolverClassificacao,
  revalidar,
  type EstadoForm,
} from "@/lib/acoes";

export type RecorrenteFormState = EstadoForm;

const ESQUEMA = {
  descricao: campo.texto("Descrição"),
  valor_previsto: campo.dinheiro("Valor"),
  quinzena: campo.umDeNumero("Quinzena", [15, 30] as const),
  dia_vencimento: opcional(
    campo.inteiro("Dia de vencimento", { min: 1, max: 31 }),
  ),
  ativa: campo.booleano(),
};

const CLASSIFICACAO = {
  categoria_id: campo.cru(),
  quem_gastou: campo.cru(),
};

const ROTAS = ["/recorrentes", "/relatorios/compras-do-mes", "/"];

/** Campos do formulário + categoria/quem já validados contra o banco. */
async function montarLinha(formData: FormData) {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return dados;

  const brutos = parseForm(formData, CLASSIFICACAO);
  if (typeof brutos === "string") return brutos;

  const supabase = await createClient();
  const classificacao = await resolverClassificacao(
    supabase,
    brutos.categoria_id,
    brutos.quem_gastou,
  );
  if (typeof classificacao === "string") return classificacao;

  return { supabase, linha: { ...dados, ...classificacao } };
}

export async function createRecorrente(
  _prev: RecorrenteFormState,
  formData: FormData,
): Promise<RecorrenteFormState> {
  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const montado = await montarLinha(formData);
  if (typeof montado === "string") return { error: montado };

  const { error } = await montado.supabase
    .from("contas_recorrentes")
    .insert(montado.linha);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function updateRecorrente(
  id: string,
  _prev: RecorrenteFormState,
  formData: FormData,
): Promise<RecorrenteFormState> {
  const montado = await montarLinha(formData);
  if (typeof montado === "string") return { error: montado };

  const { error } = await montado.supabase
    .from("contas_recorrentes")
    .update(montado.linha)
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function deleteRecorrente(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contas_recorrentes")
    .delete()
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS);
}

export async function toggleRecorrenteAtiva(id: string, ativa: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contas_recorrentes")
    .update({ ativa })
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS);
}
