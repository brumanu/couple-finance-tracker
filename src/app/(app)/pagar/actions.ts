"use server";

import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/mes";
import { campo, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  type EstadoForm,
} from "@/lib/acoes";

export type PagarFormState = EstadoForm;

/** Data em branco = hoje. Os dois dialogs de pagamento aceitam isso. */
function dataOuHoje(formData: FormData): string | null {
  const bruta = String(formData.get("data_pagamento") ?? "").trim();
  if (!bruta) return hojeISO();
  return /^\d{4}-\d{2}-\d{2}$/.test(bruta) ? bruta : null;
}

export async function pagarContaRecorrente(
  contaRecorrenteId: string,
  dataReferencia: string, // YYYY-MM-01
  quinzena: 15 | 30,
  _prev: PagarFormState,
  formData: FormData,
): Promise<PagarFormState> {
  const dados = parseForm(formData, {
    valor: campo.dinheiro("Valor"),
    descricao: campo.texto("Descrição"),
  });
  if (typeof dados === "string") return { error: dados };

  const dataPagamento = dataOuHoje(formData);
  if (!dataPagamento) return { error: "Data inválida." };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  // Herda categoria e quem gastou da conta recorrente: sem isso o lançamento
  // nasce sem categoria e os relatórios jogam a conta paga em "Sem categoria".
  const { data: conta } = await sessao.supabase
    .from("contas_recorrentes")
    .select("categoria_id, categoria, quem_gastou")
    .eq("id", contaRecorrenteId)
    .maybeSingle();

  const { error } = await sessao.supabase.from("lancamentos").insert({
    tipo: "conta_fixa",
    descricao: dados.descricao,
    valor: dados.valor,
    data_referencia: dataReferencia,
    data_pagamento: dataPagamento,
    quinzena,
    categoria_id: conta?.categoria_id ?? null,
    categoria: conta?.categoria ?? null,
    quem_gastou: conta?.quem_gastou ?? null,
    conta_recorrente_id: contaRecorrenteId,
  });

  if (error) {
    // 23505 = índice único (conta_recorrente_id, data_referencia): o parceiro
    // já marcou essa conta como paga neste mês, ou a página estava em 2 abas.
    // Revalida antes de responder pra tela já mostrar o estado real.
    if (error.code === "23505") revalidar("/");
    return {
      error: erroAmigavel(error, {
        "23505": "Essa conta já está marcada como paga neste mês.",
      }),
    };
  }

  revalidar("/");
  return { ok: true };
}

export async function desmarcarPagamento(lancamentoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos")
    .delete()
    .eq("id", lancamentoId);
  if (error) return { error: erroAmigavel(error) };
  revalidar("/");
}

/**
 * Marca uma fatura de cartão como paga. Diferente da conta fixa, aqui não
 * nasce um lançamento: o gasto já está nas compras/assinaturas do cartão, e
 * a linha em `pagamentos_fatura` só registra que a fatura foi quitada.
 */
export async function pagarFatura(
  cartaoId: string,
  mesReferencia: string, // YYYY-MM-01
  _prev: PagarFormState,
  formData: FormData,
): Promise<PagarFormState> {
  // Fatura zerada é um caso real (mês sem compra), então aqui zero passa.
  const dados = parseForm(formData, {
    valor: campo.dinheiro("Valor", { permiteZero: true }),
  });
  if (typeof dados === "string") return { error: dados };

  const dataPagamento = dataOuHoje(formData);
  if (!dataPagamento) return { error: "Data inválida." };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  // upsert em vez de insert: se a fatura já estiver marcada (duas abas, ou
  // clique duplo), atualiza em vez de estourar o unique (cartao_id, mes).
  const { error } = await sessao.supabase.from("pagamentos_fatura").upsert(
    {
      cartao_id: cartaoId,
      mes_referencia: mesReferencia,
      valor: dados.valor,
      data_pagamento: dataPagamento,
    },
    { onConflict: "cartao_id,mes_referencia" },
  );

  if (error) return { error: erroAmigavel(error) };

  revalidar("/");
  return { ok: true };
}

export async function desmarcarFatura(pagamentoFaturaId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pagamentos_fatura")
    .delete()
    .eq("id", pagamentoFaturaId);
  if (error) return { error: erroAmigavel(error) };
  revalidar("/");
}
