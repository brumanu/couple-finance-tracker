"use server";

import { createClient } from "@/lib/supabase/server";
import { mesAtual } from "@/lib/mes";
import { mesPrimeiraParcela } from "@/lib/cartao-calc";
import { formatBRL } from "@/lib/format";
import type { SearchResultItem } from "./types";

const LIMIT = 8;

type LancamentoRow = {
  id: string;
  tipo: "despesa_avulsa" | "renda_extra";
  descricao: string;
  valor: number | string;
  data_referencia: string; // YYYY-MM-DD
};

type RendaRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  dia_recebimento: number;
};

type ContaRecorrenteRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  quinzena: number;
};

type CompraCartaoRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string; // YYYY-MM-DD
  parcelas: number;
};

type AssinaturaCartaoRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
};

type CartaoRow = {
  id: string;
  dia_fechamento: number;
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Busca lançamentos por descrição em qualquer mês, em todas as tabelas
 * de lançamento do app (despesas avulsas, renda extra, rendas fixas,
 * contas fixas, compras no cartão e assinaturas de cartão).
 *
 * RLS já escopa cada tabela pelo casal do usuário autenticado, então não
 * é preciso filtrar `casal_id` manualmente aqui.
 */
export async function buscarGlobal(
  query: string,
): Promise<SearchResultItem[]> {
  const termo = query.trim();
  if (termo.length < 2) return [];

  const supabase = await createClient();
  const padrao = `%${termo}%`;

  const [
    lancamentosRes,
    rendasRes,
    contasRes,
    comprasRes,
    assinaturasRes,
    cartoesRes,
  ] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("id, tipo, descricao, valor, data_referencia")
      .in("tipo", ["despesa_avulsa", "renda_extra"])
      .ilike("descricao", padrao)
      .order("data_referencia", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("rendas")
      .select("id, descricao, valor_previsto, dia_recebimento")
      .ilike("descricao", padrao)
      .limit(LIMIT),
    supabase
      .from("contas_recorrentes")
      .select("id, descricao, valor_previsto, quinzena")
      .ilike("descricao", padrao)
      .limit(LIMIT),
    supabase
      .from("compras_cartao")
      .select("id, cartao_id, descricao, valor_total, data_compra, parcelas")
      .ilike("descricao", padrao)
      .order("data_compra", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("assinaturas_cartao")
      .select("id, cartao_id, descricao, valor_mensal")
      .ilike("descricao", padrao)
      .limit(LIMIT),
    // Tabela pequena por casal — sem filtro, só pra casar cartao_id -> dia_fechamento
    supabase.from("cartoes").select("id, dia_fechamento"),
  ]);

  const cartaoPorId = new Map(
    ((cartoesRes.data ?? []) as CartaoRow[]).map((c) => [
      c.id,
      c.dia_fechamento,
    ]),
  );

  const resultados: SearchResultItem[] = [];

  for (const l of (lancamentosRes.data ?? []) as LancamentoRow[]) {
    const mesChave = l.data_referencia.slice(0, 7);
    if (l.tipo === "despesa_avulsa") {
      resultados.push({
        categoria: "despesa",
        id: l.id,
        titulo: l.descricao,
        subtitulo: `Despesa avulsa · ${formatDataBR(l.data_referencia)}`,
        valor: Number(l.valor),
        href: `/despesas?mes=${mesChave}`,
      });
    } else {
      resultados.push({
        categoria: "renda_extra",
        id: l.id,
        titulo: l.descricao,
        subtitulo: `Renda extra · ${formatDataBR(l.data_referencia)}`,
        valor: Number(l.valor),
        href: `/rendas?mes=${mesChave}`,
      });
    }
  }

  for (const r of (rendasRes.data ?? []) as RendaRow[]) {
    resultados.push({
      categoria: "renda_fixa",
      id: r.id,
      titulo: r.descricao,
      subtitulo: `Renda fixa · dia ${r.dia_recebimento} · ${formatBRL(r.valor_previsto)}`,
      valor: Number(r.valor_previsto),
      href: "/rendas",
    });
  }

  for (const c of (contasRes.data ?? []) as ContaRecorrenteRow[]) {
    resultados.push({
      categoria: "conta_recorrente",
      id: c.id,
      titulo: c.descricao,
      subtitulo: `Conta fixa · ${formatBRL(c.valor_previsto)}`,
      valor: Number(c.valor_previsto),
      href: "/recorrentes",
    });
  }

  for (const compra of (comprasRes.data ?? []) as CompraCartaoRow[]) {
    const diaFechamento = cartaoPorId.get(compra.cartao_id);
    const chave = diaFechamento
      ? mesPrimeiraParcela(compra.data_compra, diaFechamento).chave
      : mesAtual().chave;
    resultados.push({
      categoria: "compra_cartao",
      id: compra.id,
      titulo: compra.descricao,
      subtitulo:
        compra.parcelas > 1
          ? `Compra no cartão · ${compra.parcelas}x · ${formatDataBR(compra.data_compra)}`
          : `Compra no cartão · ${formatDataBR(compra.data_compra)}`,
      valor: Number(compra.valor_total),
      href: `/cartoes/${compra.cartao_id}?mes=${chave}`,
    });
  }

  for (const a of (assinaturasRes.data ?? []) as AssinaturaCartaoRow[]) {
    resultados.push({
      categoria: "assinatura_cartao",
      id: a.id,
      titulo: a.descricao,
      subtitulo: `Assinatura · ${formatBRL(a.valor_mensal)}/mês`,
      valor: Number(a.valor_mensal),
      href: `/cartoes/${a.cartao_id}?mes=${mesAtual().chave}`,
    });
  }

  return resultados;
}
