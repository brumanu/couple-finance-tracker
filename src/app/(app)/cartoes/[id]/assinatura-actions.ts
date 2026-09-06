"use server";

import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/mes";
import { campo, opcional, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  resolverClassificacao,
  revalidar,
  type EstadoForm,
  type SessaoDaAcao,
} from "@/lib/acoes";

export type AssinaturaFormState = EstadoForm;

const ESQUEMA = {
  cartao_id: campo.texto("Cartão"),
  descricao: campo.texto("Descrição"),
  valor_mensal: campo.dinheiro("Valor mensal"),
  fim_vigencia: opcional(campo.data("Data de fim")),
  ativa: campo.booleano(),
  categoria_id: campo.cru(),
  quem_gastou: campo.cru(),
};

const rotas = (cartaoId: string) => [
  `/cartoes/${cartaoId}`,
  "/cartoes",
  "/relatorios/compras-do-mes",
  "/",
];

async function montarLinha(supabase: SessaoDaAcao, formData: FormData) {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return dados;

  // Início em branco = começa hoje. Fica fora do esquema porque o default
  // depende do relógio, e `campo.data` é puro.
  const inicio = String(formData.get("inicio_vigencia") ?? "").trim();
  const inicio_vigencia = inicio || hojeISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio_vigencia)) {
    return "Data de início inválida.";
  }
  if (dados.fim_vigencia && dados.fim_vigencia < inicio_vigencia) {
    return "Data de fim deve ser depois da de início.";
  }

  const classificacao = await resolverClassificacao(
    supabase,
    dados.categoria_id,
    dados.quem_gastou,
  );
  if (typeof classificacao === "string") return classificacao;

  const { categoria_id, quem_gastou, ...campos } = dados;
  void categoria_id;
  void quem_gastou;

  return { ...campos, inicio_vigencia, ...classificacao };
}

export async function createAssinatura(
  _prev: AssinaturaFormState,
  formData: FormData,
): Promise<AssinaturaFormState> {
  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const linha = await montarLinha(sessao.supabase, formData);
  if (typeof linha === "string") return { error: linha };

  // `casal_id` e `criada_por` vêm dos defaults da coluna (migration 0014).
  const { error } = await sessao.supabase
    .from("assinaturas_cartao")
    .insert(linha);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...rotas(linha.cartao_id));
  return { ok: true };
}

export async function updateAssinatura(
  id: string,
  _prev: AssinaturaFormState,
  formData: FormData,
): Promise<AssinaturaFormState> {
  const supabase = await createClient();

  const linha = await montarLinha(supabase, formData);
  if (typeof linha === "string") return { error: linha };

  const { error } = await supabase
    .from("assinaturas_cartao")
    .update(linha)
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...rotas(linha.cartao_id));
  return { ok: true };
}

export async function deleteAssinatura(id: string, cartaoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assinaturas_cartao")
    .delete()
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...rotas(cartaoId));
}

export async function toggleAssinaturaAtiva(
  id: string,
  cartaoId: string,
  ativa: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assinaturas_cartao")
    .update({ ativa })
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...rotas(cartaoId));
}

/** Encerra a assinatura setando fim_vigencia como hoje. */
export async function cancelarAssinatura(id: string, cartaoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assinaturas_cartao")
    .update({ fim_vigencia: hojeISO() })
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...rotas(cartaoId));
}
