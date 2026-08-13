import { buildMes, type MesRef } from "@/lib/mes";

export type CartaoInfo = {
  id: string;
  dia_fechamento: number;
  dia_vencimento: number;
};

export type CompraCartaoInfo = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string; // YYYY-MM-DD
  parcelas: number;
  parcelas_ja_pagas?: number; // default 0 quando ausente
  categoria: string | null;
};

export type AssinaturaCartaoInfo = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
  categoria: string | null;
  inicio_vigencia: string; // YYYY-MM-DD
  fim_vigencia: string | null; // YYYY-MM-DD | null
  ativa: boolean;
};

/**
 * Uma assinatura entra na fatura de um mês se estiver ativa e sua
 * vigência intersecta o mês. Não depende de dia_fechamento — o valor
 * mensal cai integral em toda fatura enquanto vigente.
 */
export function assinaturaAtivaNoMes(
  assinatura: AssinaturaCartaoInfo,
  mes: MesRef,
): boolean {
  if (!assinatura.ativa) return false;
  if (assinatura.inicio_vigencia > mes.ultimoDia) return false;
  if (
    assinatura.fim_vigencia !== null &&
    assinatura.fim_vigencia < mes.primeiroDia
  )
    return false;
  return true;
}

/**
 * Retorna o mês em que a PRIMEIRA parcela da compra cai.
 *
 * Regra clássica dos bancos brasileiros:
 * - Se o dia da compra <= dia_fechamento do cartão, a compra entra na
 *   fatura que fecha ESSE mês (paga esse mês).
 * - Se o dia da compra > dia_fechamento, entra na fatura do PRÓXIMO mês.
 */
export function mesPrimeiraParcela(
  dataCompraISO: string,
  diaFechamento: number,
): MesRef {
  const [ano, mes, dia] = dataCompraISO.split("-").map(Number);
  const cai = dia <= diaFechamento ? mes : mes + 1;
  if (cai > 12) return buildMes(ano + 1, cai - 12);
  return buildMes(ano, cai);
}

/**
 * Distribui o valor total em N parcelas iguais, garantindo que a soma
 * bata exatamente com o total (a última parcela pega a diferença dos
 * arredondamentos).
 */
export function valoresParcelas(
  valorTotal: number,
  parcelas: number,
): number[] {
  if (parcelas <= 1) return [Number(valorTotal.toFixed(2))];
  const base = Math.floor((valorTotal * 100) / parcelas) / 100;
  const cents = Math.round(valorTotal * 100);
  const somaBase = Math.round(base * 100) * (parcelas - 1);
  const ultima = Math.max(0, (cents - somaBase) / 100);
  const arr = Array(parcelas - 1).fill(base);
  arr.push(Number(ultima.toFixed(2)));
  return arr;
}

/**
 * Retorna informações da parcela de uma compra no mês solicitado.
 * null se a compra não tem parcela ativa nesse mês.
 */
export function parcelaNoMes(
  compra: CompraCartaoInfo,
  diaFechamento: number,
  mesAlvo: MesRef,
): {
  numero: number;
  total: number;
  valor: number;
  ultimaParcela: MesRef;
  restanteAposEste: number; // valor que ainda falta pagar depois desta parcela
} | null {
  const primeira = mesPrimeiraParcela(compra.data_compra, diaFechamento);
  const parcelas = compra.parcelas;
  const jaPagas = Math.max(0, compra.parcelas_ja_pagas ?? 0);

  // Índice do mês alvo relativo à primeira parcela
  const meses =
    (mesAlvo.ano - primeira.ano) * 12 + (mesAlvo.mes - primeira.mes);
  // Pula as parcelas 1..jaPagas — elas ficaram no passado antes do cadastro
  if (meses < jaPagas || meses >= parcelas) return null;

  const valores = valoresParcelas(Number(compra.valor_total), parcelas);
  const numero = meses + 1;
  const valor = valores[meses];

  // Última parcela = primeira + (parcelas - 1)
  const totalMesesUltima = primeira.mes + parcelas - 1;
  const anoUltima = primeira.ano + Math.floor((totalMesesUltima - 1) / 12);
  const mesUltima = ((totalMesesUltima - 1) % 12) + 1;
  const ultimaParcela = buildMes(anoUltima, mesUltima);

  const restanteAposEste = valores
    .slice(numero) // parcelas após a atual
    .reduce((s, v) => s + v, 0);

  return {
    numero,
    total: parcelas,
    valor,
    ultimaParcela,
    restanteAposEste: Number(restanteAposEste.toFixed(2)),
  };
}

/**
 * Calcula a fatura consolidada de um cartão para o mês alvo:
 * total + parcelas de compras + assinaturas ativas.
 */
export function faturaDoMes(
  cartao: CartaoInfo,
  compras: CompraCartaoInfo[],
  mesAlvo: MesRef,
  assinaturas: AssinaturaCartaoInfo[] = [],
): {
  total: number;
  parcelas: {
    compra: CompraCartaoInfo;
    numero: number;
    total: number;
    valor: number;
  }[];
  assinaturas: {
    assinatura: AssinaturaCartaoInfo;
    valor: number;
  }[];
} {
  const parcelas: {
    compra: CompraCartaoInfo;
    numero: number;
    total: number;
    valor: number;
  }[] = [];
  const assinaturasAtivas: {
    assinatura: AssinaturaCartaoInfo;
    valor: number;
  }[] = [];
  let total = 0;
  for (const c of compras) {
    if (c.cartao_id !== cartao.id) continue;
    const info = parcelaNoMes(c, cartao.dia_fechamento, mesAlvo);
    if (!info) continue;
    parcelas.push({
      compra: c,
      numero: info.numero,
      total: info.total,
      valor: info.valor,
    });
    total += info.valor;
  }
  for (const a of assinaturas) {
    if (a.cartao_id !== cartao.id) continue;
    if (!assinaturaAtivaNoMes(a, mesAlvo)) continue;
    const v = Number(a.valor_mensal);
    assinaturasAtivas.push({ assinatura: a, valor: v });
    total += v;
  }
  return {
    total: Number(total.toFixed(2)),
    parcelas,
    assinaturas: assinaturasAtivas,
  };
}

/**
 * Quinzena em que a fatura do cartão vence:
 * - vencimento entre dia 1 e 15 → quinzena 15
 * - vencimento entre dia 16 e 31 → quinzena 30
 */
export function quinzenaDoCartao(diaVencimento: number): 15 | 30 {
  return diaVencimento <= 15 ? 15 : 30;
}
