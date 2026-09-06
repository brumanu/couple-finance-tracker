"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  resolverClassificacao,
  revalidar,
  type EstadoForm,
  type SessaoDaAcao,
} from "@/lib/acoes";

export type CompraFormState = EstadoForm;

const ESQUEMA = {
  cartao_id: campo.texto("Cartão"),
  descricao: campo.texto("Descrição"),
  valor_total: campo.dinheiro("Valor"),
  data_compra: campo.data("Data"),
  parcelas: campo.inteiro("Parcelas", { min: 1, max: 60 }),
  categoria_id: campo.cru(),
  quem_gastou: campo.cru(),
};

const rotas = (cartaoId: string) => [
  `/cartoes/${cartaoId}`,
  "/cartoes",
  "/relatorios/compras-do-mes",
  "/",
];

/**
 * Lê o formulário e devolve a linha pronta pra `compras_cartao`.
 *
 * "Compra em andamento" é o caso de uma compra antiga que já vinha sendo paga
 * quando entrou no app: o usuário informa em qual parcela está e a gente
 * guarda quantas já foram.
 */
async function montarLinha(supabase: SessaoDaAcao, formData: FormData) {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return dados;

  const emAndamento =
    formData.get("em_andamento") === "on" ||
    formData.get("em_andamento") === "true";

  let parcelasJaPagas = 0;
  if (emAndamento) {
    const parcelaAtual = Number(formData.get("parcela_atual") ?? 1);
    if (
      !Number.isInteger(parcelaAtual) ||
      parcelaAtual < 2 ||
      parcelaAtual > dados.parcelas
    ) {
      return `Se a compra está em andamento, a parcela atual deve estar entre 2 e ${dados.parcelas}. Se você está na parcela 1, desmarque "Compra em andamento".`;
    }
    parcelasJaPagas = parcelaAtual - 1;
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

  return {
    ...campos,
    parcelas_ja_pagas: parcelasJaPagas,
    ...classificacao,
  };
}

export async function createCompra(
  _prev: CompraFormState,
  formData: FormData,
): Promise<CompraFormState> {
  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const linha = await montarLinha(sessao.supabase, formData);
  if (typeof linha === "string") return { error: linha };

  const { error } = await sessao.supabase
    .from("compras_cartao")
    .insert(linha);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...rotas(linha.cartao_id));
  return { ok: true };
}

export async function updateCompra(
  id: string,
  _prev: CompraFormState,
  formData: FormData,
): Promise<CompraFormState> {
  const supabase = await createClient();

  const linha = await montarLinha(supabase, formData);
  if (typeof linha === "string") return { error: linha };

  const { error } = await supabase
    .from("compras_cartao")
    .update(linha)
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...rotas(linha.cartao_id));
  return { ok: true };
}

export async function deleteCompra(id: string, cartaoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("compras_cartao")
    .delete()
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...rotas(cartaoId));
}
