import { buildMes, vigenteNoMes, type MesRef } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import {
  faturaDoMes,
  type AssinaturaCartaoInfo,
  type CompraCartaoInfo,
} from "@/lib/cartao-calc";

/**
 * Quais lembretes de vencimento o cron de push manda hoje pra um casal.
 *
 * Função pura: a rota busca os dados, chama isto e envia o resultado. Assim
 * a regra de "quem vence e quando" fica testável sem banco nem web-push.
 */

/** Dias antes do vencimento em que o aviso sai: 2 dias antes, véspera e o dia. */
export const DIAS_DE_AVISO = [2, 1, 0] as const;

export type ContaParaLembrete = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  dia_vencimento: number | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
};

export type CartaoParaLembrete = {
  id: string;
  dia_fechamento: number;
  dia_vencimento: number;
  /** Nome que aparece no aviso: o do banco, o apelido ou "Cartão". */
  nome: string;
};

export type DadosDoCasal = {
  contas: ContaParaLembrete[];
  cartoes: CartaoParaLembrete[];
  compras: CompraCartaoInfo[];
  assinaturas: AssinaturaCartaoInfo[];
  /** `${conta_recorrente_id}|${YYYY-MM-01}` das contas fixas já pagas. */
  contasPagas: Set<string>;
  /** `${cartao_id}|${YYYY-MM-01}` das faturas marcadas como pagas. */
  faturasPagas: Set<string>;
};

export type Lembrete = {
  title: string;
  body: string;
  url: string;
};

type Dia = { ano: number; mes: number; dia: number }; // mes 1-12

function lerISO(iso: string): Dia {
  return {
    ano: Number(iso.slice(0, 4)),
    mes: Number(iso.slice(5, 7)),
    dia: Number(iso.slice(8, 10)),
  };
}

function ultimoDia(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Próxima ocorrência (a partir de hoje, inclusive) de um dia do mês. Mês
 * curto não estoura: vencimento dia 31 num mês de 30 dias cai no dia 30.
 */
export function proximoVencimento(diaVencimento: number, hoje: Dia): Dia {
  const diaEsteMes = Math.min(diaVencimento, ultimoDia(hoje.ano, hoje.mes));
  if (diaEsteMes >= hoje.dia) {
    return { ano: hoje.ano, mes: hoje.mes, dia: diaEsteMes };
  }
  const ano = hoje.mes === 12 ? hoje.ano + 1 : hoje.ano;
  const mes = hoje.mes === 12 ? 1 : hoje.mes + 1;
  return { ano, mes, dia: Math.min(diaVencimento, ultimoDia(ano, mes)) };
}

/** Dias inteiros de `hoje` até `alvo`. Em UTC, então horário de verão não conta. */
function diasAte(alvo: Dia, hoje: Dia): number {
  const a = Date.UTC(alvo.ano, alvo.mes - 1, alvo.dia);
  const h = Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia);
  return Math.round((a - h) / 86_400_000);
}

function quando(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `em ${dias} dias`;
}

function ehDiaDeAviso(dias: number): boolean {
  return (DIAS_DE_AVISO as readonly number[]).includes(dias);
}

/**
 * @param hojeIso data de hoje em São Paulo, "YYYY-MM-DD" (ver `hojeISO`).
 */
export function montarLembretes(dados: DadosDoCasal, hojeIso: string): Lembrete[] {
  const hoje = lerISO(hojeIso);
  const lembretes: Lembrete[] = [];

  for (const conta of dados.contas) {
    if (conta.dia_vencimento == null) continue;
    const venc = proximoVencimento(conta.dia_vencimento, hoje);
    const dias = diasAte(venc, hoje);
    if (!ehDiaDeAviso(dias)) continue;

    const mes: MesRef = buildMes(venc.ano, venc.mes);
    // Mesmo critério do dashboard: conta fora da vigência não existe no mês.
    if (!vigenteNoMes(conta, mes)) continue;
    if (dados.contasPagas.has(`${conta.id}|${mes.primeiroDia}`)) continue;

    lembretes.push({
      title: `Conta vence ${quando(dias)}`,
      body: `${conta.descricao} — ${formatBRL(conta.valor_previsto)}`,
      url: "/",
    });
  }

  for (const cartao of dados.cartoes) {
    const venc = proximoVencimento(cartao.dia_vencimento, hoje);
    const dias = diasAte(venc, hoje);
    if (!ehDiaDeAviso(dias)) continue;

    // A fatura "do mês" é a que vence nele — mesma chave que o dashboard usa
    // pra marcar como paga.
    const mes = buildMes(venc.ano, venc.mes);
    if (dados.faturasPagas.has(`${cartao.id}|${mes.primeiroDia}`)) continue;

    const fatura = faturaDoMes(cartao, dados.compras, mes, dados.assinaturas);
    if (fatura.total <= 0) continue;

    lembretes.push({
      title: `Fatura vence ${quando(dias)}`,
      body: `${cartao.nome}: ${formatBRL(fatura.total)}`,
      url: `/cartoes/${cartao.id}`,
    });
  }

  return lembretes;
}
