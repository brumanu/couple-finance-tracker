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
 * Dados do cartão que definem em qual fatura uma compra cai.
 * O vencimento importa tanto quanto o fechamento — ver mesPrimeiraParcela.
 */
export type CartaoFatura = Pick<
  CartaoInfo,
  "dia_fechamento" | "dia_vencimento"
>;

// Usado quando o cartão da compra não foi encontrado (dado órfão). Vencimento
// depois do fechamento = sem deslocamento de mês, que era o comportamento
// antigo do `?? 1` espalhado pelos relatórios.
const FATURA_PADRAO: CartaoFatura = { dia_fechamento: 1, dia_vencimento: 10 };

/**
 * Retorna o mês da fatura em que a PRIMEIRA parcela da compra cai.
 *
 * "Mês da fatura" é sempre o mês do VENCIMENTO, que é quando o dinheiro
 * realmente sai — é assim que a sobra da quinzena, o dashboard e os
 * relatórios tratam o gasto.
 *
 * Duas etapas:
 * 1. Em que mês a fatura FECHA? Compra até o dia_fechamento fecha no próprio
 *    mês; depois disso, fecha no mês seguinte.
 * 2. Em que mês essa fatura VENCE? Se dia_vencimento > dia_fechamento, vence
 *    no mesmo mês em que fechou (ex.: fecha 10, vence 17). Se o vencimento é
 *    igual ou anterior ao fechamento, vence no mês seguinte — é o caso comum
 *    de "fecha 25, vence 5" e era exatamente o que faltava aqui.
 */
export function mesPrimeiraParcela(
  dataCompraISO: string,
  cartao: CartaoFatura | null | undefined,
): MesRef {
  const { dia_fechamento, dia_vencimento } = cartao ?? FATURA_PADRAO;
  const [ano, mes, dia] = dataCompraISO.split("-").map(Number);
  let alvo = dia <= dia_fechamento ? mes : mes + 1;
  if (dia_vencimento <= dia_fechamento) alvo += 1;
  return buildMes(ano + Math.floor((alvo - 1) / 12), ((alvo - 1) % 12) + 1);
}

/**
 * Mês da parcela que cai `offsetMeses` depois da primeira (offset 0 = a
 * primeira). Centraliza a aritmética de virada de ano que estava repetida
 * em parcelaNoMes, no dialog de compra e na tela do cartão.
 */
export function mesDaParcela(primeira: MesRef, offsetMeses: number): MesRef {
  const total = primeira.mes + offsetMeses;
  return buildMes(
    primeira.ano + Math.floor((total - 1) / 12),
    ((total - 1) % 12) + 1,
  );
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
  // Trabalha em centavos inteiros: (valorTotal * 100) em float perde precisão
  // (1.15 * 100 = 114.99999999999999) e derrubava um centavo de cada parcela.
  const cents = Math.round(valorTotal * 100);
  if (parcelas <= 1) return [cents / 100];
  const base = Math.floor(cents / parcelas);
  const ultima = cents - base * (parcelas - 1);
  const arr: number[] = Array(parcelas - 1).fill(base / 100);
  arr.push(ultima / 100);
  return arr;
}

/**
 * Retorna informações da parcela de uma compra no mês solicitado.
 * null se a compra não tem parcela ativa nesse mês.
 */
export function parcelaNoMes(
  compra: CompraCartaoInfo,
  cartao: CartaoFatura | null | undefined,
  mesAlvo: MesRef,
): {
  numero: number;
  total: number;
  valor: number;
  ultimaParcela: MesRef;
  restanteAposEste: number; // valor que ainda falta pagar depois desta parcela
} | null {
  const primeira = mesPrimeiraParcela(compra.data_compra, cartao);
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

  const ultimaParcela = mesDaParcela(primeira, parcelas - 1);

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
    const info = parcelaNoMes(c, cartao, mesAlvo);
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
