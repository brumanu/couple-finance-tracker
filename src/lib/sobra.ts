import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mesProximo, type MesRef } from "@/lib/mes";
import {
  faturaDoMes,
  type CompraCartaoInfo,
  type AssinaturaCartaoInfo,
} from "@/lib/cartao-calc";

/**
 * A conta de "quanto sobra no mês" nasceu dentro do dashboard. Como outras
 * telas precisam do mesmo número (a lista de compras futuras, por exemplo),
 * a fórmula mora aqui — em duas camadas:
 *
 * - `calcularSaldoMes`: pura, recebe os dados já carregados. É o que o
 *   dashboard usa, já que ele carrega tudo pra montar os outros cards.
 * - `getSaldoMensal`: busca no banco e chama a pura. É o que telas que só
 *   querem o saldo usam, sem replicar seis queries.
 *
 * As duas compartilham a fórmula, então o número nunca diverge entre telas.
 */

export type RendaFixa = {
  valor_previsto: number | string;
};

export type ContaRecorrente = {
  id: string;
  valor_previsto: number | string;
  inicio_vigencia: string;
  fim_vigencia: string | null;
};

export type LancamentoSaldo = {
  tipo: string;
  valor: number | string;
  data_referencia: string;
  conta_recorrente_id: string | null;
};

export type CartaoSaldo = {
  id: string;
  dia_fechamento: number;
  dia_vencimento: number;
};

export type DadosSaldo = {
  rendas: RendaFixa[];
  contas: ContaRecorrente[];
  lancamentos: LancamentoSaldo[];
  cartoes: CartaoSaldo[];
  compras: CompraCartaoInfo[];
  assinaturas: AssinaturaCartaoInfo[];
};

export type SaldoMes = {
  totalRenda: number;
  totalRendaExtra: number;
  totalContasRec: number;
  totalCartoes: number;
  totalDespesas: number;
  saldo: number;
};

/** Fórmula do saldo do mês. Pura — não toca no banco. */
export function calcularSaldoMes(
  dados: DadosSaldo,
  mesRef: MesRef,
): SaldoMes {
  const lancsMes = dados.lancamentos.filter(
    (l) =>
      l.data_referencia >= mesRef.primeiroDia &&
      l.data_referencia <= mesRef.ultimoDia,
  );
  const contasMes = dados.contas.filter(
    (c) =>
      c.inicio_vigencia <= mesRef.ultimoDia &&
      (c.fim_vigencia === null || c.fim_vigencia >= mesRef.primeiroDia),
  );

  // Conta fixa já paga vale o valor real do pagamento, não o previsto.
  const pagosMes = new Map<string, LancamentoSaldo>();
  for (const l of lancsMes) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagosMes.set(l.conta_recorrente_id, l);
    }
  }

  const totalRendaFixa = dados.rendas.reduce(
    (s, r) => s + Number(r.valor_previsto),
    0,
  );
  const totalContasRec = contasMes.reduce((s, c) => {
    const pago = pagosMes.get(c.id);
    return s + (pago ? Number(pago.valor) : Number(c.valor_previsto));
  }, 0);
  const totalCartoes = dados.cartoes.reduce(
    (s, c) =>
      s +
      faturaDoMes(
        {
          id: c.id,
          dia_fechamento: c.dia_fechamento,
          dia_vencimento: c.dia_vencimento,
        },
        dados.compras,
        mesRef,
        dados.assinaturas,
      ).total,
    0,
  );
  const totalDespesas = lancsMes
    .filter((l) => l.tipo === "despesa_avulsa")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalRendaExtra = lancsMes
    .filter((l) => l.tipo === "renda_extra")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalRenda = totalRendaFixa + totalRendaExtra;

  return {
    totalRenda,
    totalRendaExtra,
    totalContasRec,
    totalCartoes,
    totalDespesas,
    saldo: totalRenda - totalContasRec - totalCartoes - totalDespesas,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Saldo de cada um dos `quantosMeses` meses a partir de `inicio`. Faz as
 * queries por conta — pra telas que só querem o número da sobra.
 */
export async function getSaldoMensal(
  inicio: MesRef,
  quantosMeses: number,
): Promise<{ mes: MesRef; saldo: SaldoMes }[]> {
  const meses: MesRef[] = [];
  let cursor = inicio;
  for (let i = 0; i < quantosMeses; i += 1) {
    meses.push(cursor);
    cursor = mesProximo(cursor);
  }
  const primeiroDia = meses[0].primeiroDia;
  const ultimoDia = meses[meses.length - 1].ultimoDia;

  // Compra feita há mais de 60 meses (máximo de parcelas) antes do primeiro
  // mês da janela não pode ter parcela ativa nela.
  const cutoff = new Date(meses[0].ano, meses[0].mes - 1 - 60, 1);
  const comprasCutoff = `${cutoff.getFullYear()}-${pad2(cutoff.getMonth() + 1)}-01`;

  const supabase = await createClient();
  const [rendasRes, contasRes, lancRes, cartoesRes, comprasRes, assinRes] =
    await Promise.all([
      supabase.from("rendas").select("valor_previsto").eq("ativa", true),
      supabase
        .from("contas_recorrentes")
        .select("id, valor_previsto, inicio_vigencia, fim_vigencia")
        .eq("ativa", true)
        .or(`fim_vigencia.is.null,fim_vigencia.gte.${primeiroDia}`),
      supabase
        .from("lancamentos")
        .select("tipo, valor, data_referencia, conta_recorrente_id")
        .gte("data_referencia", primeiroDia)
        .lte("data_referencia", ultimoDia),
      supabase
        .from("cartoes")
        .select("id, dia_fechamento, dia_vencimento")
        .eq("ativo", true),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria",
        )
        .gte("data_compra", comprasCutoff),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, descricao, valor_mensal, categoria, inicio_vigencia, fim_vigencia, ativa",
        )
        .eq("ativa", true),
    ]);

  const dados: DadosSaldo = {
    rendas: (rendasRes.data ?? []) as RendaFixa[],
    contas: (contasRes.data ?? []) as ContaRecorrente[],
    lancamentos: (lancRes.data ?? []) as LancamentoSaldo[],
    cartoes: (cartoesRes.data ?? []) as CartaoSaldo[],
    compras: (comprasRes.data ?? []) as CompraCartaoInfo[],
    assinaturas: (assinRes.data ?? []) as AssinaturaCartaoInfo[],
  };

  return meses.map((mes) => ({ mes, saldo: calcularSaldoMes(dados, mes) }));
}
