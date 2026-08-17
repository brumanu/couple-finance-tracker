// =====================================================================
// Cálculo de salário líquido CLT
// =====================================================================
// ATENÇÃO: as tabelas abaixo são os parâmetros oficiais e mudam todo ano
// (e às vezes no meio do ano). Elas estão concentradas aqui de propósito —
// pra atualizar basta editar este bloco, sem tocar na lógica nem na tela.
// Confira contra a fonte oficial antes de confiar nos centavos:
//   INSS  → portal gov.br/inss (tabela de contribuição)
//   IRRF  → receitafederal.gov.br (tabela progressiva mensal)
// O ano em uso aparece no rodapé da calculadora.
// =====================================================================

export const ANO_TABELA = 2026;

/**
 * INSS é progressivo por faixa: cada fatia do salário é taxada pela alíquota
 * da sua própria faixa, não a alíquota do topo sobre o total inteiro.
 */
export const FAIXAS_INSS = [
  { ate: 1631.0, aliquota: 0.075 },
  { ate: 3001.6, aliquota: 0.09 },
  { ate: 4502.4, aliquota: 0.12 },
  { ate: 8549.0, aliquota: 0.14 },
] as const;

/** Acima do teto não há contribuição — o desconto trava neste valor. */
export const TETO_INSS = FAIXAS_INSS[FAIXAS_INSS.length - 1].ate;

export const FAIXAS_IRRF = [
  { ate: 2428.8, aliquota: 0, deduzir: 0 },
  { ate: 2826.65, aliquota: 0.075, deduzir: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deduzir: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deduzir: 675.49 },
  { ate: Infinity, aliquota: 0.275, deduzir: 908.73 },
] as const;

export const DEDUCAO_POR_DEPENDENTE = 189.59;

/** Desconto simplificado mensal: substitui TODAS as deduções legais. */
export const DESCONTO_SIMPLIFICADO = 607.2;

/**
 * Lei 15.270/2025: isenção total de IRRF até R$ 5.000/mês e redução
 * parcial até R$ 7.350. Implementado como um redutor sobre o imposto
 * apurado — a tabela progressiva continua valendo por baixo.
 * A reta zera exatamente em 7.350 (1095,11 − 0,149 × 7350 ≈ 0).
 */
export const ISENCAO_TOTAL_ATE = 5000.0;
export const ISENCAO_PARCIAL_ATE = 7350.0;
const REDUTOR_BASE = 1095.11;
const REDUTOR_COEF = 0.149;

export const ALIQUOTA_FGTS = 0.08;

export type FaixaAplicada = {
  ate: number;
  aliquota: number;
  baseNaFaixa: number;
  valor: number;
};

export type ResultadoSalario = {
  bruto: number;
  inss: number;
  faixasInss: FaixaAplicada[];
  /** true quando o salário passou do teto e a contribuição travou. */
  inssNoTeto: boolean;
  irrf: number;
  baseIrrf: number;
  /** Qual base saiu mais barata: deduções legais ou desconto simplificado. */
  usouSimplificado: boolean;
  aliquotaIrrf: number;
  redutorIsencao: number;
  pensao: number;
  outrosDescontos: number;
  totalDescontos: number;
  liquido: number;
  /** Quanto o desconto total representa do bruto. */
  aliquotaEfetiva: number;
  /** Depósito do empregador — não sai do salário. */
  fgts: number;
};

export type EntradaSalario = {
  bruto: number;
  dependentes: number;
  pensao: number;
  outrosDescontos: number;
};

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/** INSS progressivo, faixa a faixa. */
export function calcularInss(bruto: number): {
  total: number;
  faixas: FaixaAplicada[];
  noTeto: boolean;
} {
  const faixas: FaixaAplicada[] = [];
  let anterior = 0;
  let total = 0;

  for (const faixa of FAIXAS_INSS) {
    if (bruto <= anterior) break;
    const baseNaFaixa = Math.min(bruto, faixa.ate) - anterior;
    const valor = baseNaFaixa * faixa.aliquota;
    total += valor;
    faixas.push({
      ate: faixa.ate,
      aliquota: faixa.aliquota,
      baseNaFaixa: arredondar(baseNaFaixa),
      valor: arredondar(valor),
    });
    anterior = faixa.ate;
  }

  return { total: arredondar(total), faixas, noTeto: bruto > TETO_INSS };
}

/** Redutor da isenção (Lei 15.270/2025) sobre o imposto já apurado. */
function calcularRedutor(bruto: number, impostoApurado: number): number {
  if (bruto <= ISENCAO_TOTAL_ATE) return impostoApurado;
  if (bruto > ISENCAO_PARCIAL_ATE) return 0;
  return Math.max(0, Math.min(impostoApurado, REDUTOR_BASE - REDUTOR_COEF * bruto));
}

export function calcularSalarioLiquido(
  entrada: EntradaSalario,
): ResultadoSalario {
  const bruto = Math.max(0, entrada.bruto);
  const dependentes = Math.max(0, Math.trunc(entrada.dependentes));
  const pensao = Math.max(0, entrada.pensao);
  const outrosDescontos = Math.max(0, entrada.outrosDescontos);

  const inssCalc = calcularInss(bruto);
  const inss = inssCalc.total;

  // O contribuinte fica com a base menor: ou as deduções legais, ou o
  // desconto simplificado (que substitui todas elas, INSS incluído).
  const baseLegal = Math.max(
    0,
    bruto - inss - dependentes * DEDUCAO_POR_DEPENDENTE - pensao,
  );
  const baseSimplificada = Math.max(0, bruto - DESCONTO_SIMPLIFICADO);
  const usouSimplificado = baseSimplificada < baseLegal;
  const baseIrrf = arredondar(Math.min(baseLegal, baseSimplificada));

  const faixa =
    FAIXAS_IRRF.find((f) => baseIrrf <= f.ate) ??
    FAIXAS_IRRF[FAIXAS_IRRF.length - 1];
  const impostoApurado = Math.max(
    0,
    baseIrrf * faixa.aliquota - faixa.deduzir,
  );

  const redutorIsencao = arredondar(calcularRedutor(bruto, impostoApurado));
  const irrf = arredondar(Math.max(0, impostoApurado - redutorIsencao));

  const totalDescontos = arredondar(inss + irrf + pensao + outrosDescontos);
  const liquido = arredondar(bruto - totalDescontos);

  return {
    bruto: arredondar(bruto),
    inss,
    faixasInss: inssCalc.faixas,
    inssNoTeto: inssCalc.noTeto,
    irrf,
    baseIrrf,
    usouSimplificado,
    aliquotaIrrf: faixa.aliquota,
    redutorIsencao,
    pensao: arredondar(pensao),
    outrosDescontos: arredondar(outrosDescontos),
    totalDescontos,
    liquido,
    aliquotaEfetiva: bruto > 0 ? totalDescontos / bruto : 0,
    fgts: arredondar(bruto * ALIQUOTA_FGTS),
  };
}
