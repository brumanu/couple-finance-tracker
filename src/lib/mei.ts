// =====================================================================
// Limite de faturamento do MEI
// =====================================================================
// ATENÇÃO: o teto anual do MEI é definido em lei complementar e já foi
// alvo de vários projetos de aumento. Está isolado aqui pra atualizar num
// lugar só quando mudar. Confira em gov.br/empresas-e-negocios (Portal do
// Empreendedor) antes de tomar decisão em cima do número.
// =====================================================================

/** Teto de faturamento por ano-calendário. */
export const LIMITE_ANUAL_MEI = 81000;

/**
 * Estourar o teto em até 20% mantém o enquadramento até o fim do ano
 * (paga-se o DAS sobre o excedente). Acima disso o desenquadramento é
 * retroativo ao início do ano — daí a faixa valer um aviso separado.
 */
export const TOLERANCIA_MEI = 0.2;
export const LIMITE_COM_TOLERANCIA_MEI =
  LIMITE_ANUAL_MEI * (1 + TOLERANCIA_MEI);

export type SituacaoMei =
  | "dentro"
  | "atencao"
  | "excedido"
  | "desenquadramento";

/**
 * `atencao` a partir de 80% do teto: é onde ainda dá tempo de segurar
 * emissão ou planejar a migração pra ME antes de estourar.
 */
export function situacaoMei(totalAno: number): SituacaoMei {
  if (totalAno > LIMITE_COM_TOLERANCIA_MEI) return "desenquadramento";
  if (totalAno > LIMITE_ANUAL_MEI) return "excedido";
  if (totalAno >= LIMITE_ANUAL_MEI * 0.8) return "atencao";
  return "dentro";
}

/**
 * Teto proporcional pra quem abriu o CNPJ no meio do ano: conta os meses
 * de atividade, incluindo o de abertura.
 */
export function limiteProporcional(mesesAtivos: number): number {
  const meses = Math.min(12, Math.max(1, Math.trunc(mesesAtivos)));
  return (LIMITE_ANUAL_MEI / 12) * meses;
}
