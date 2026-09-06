export type MesRef = {
  ano: number;
  mes: number; // 1-12
  primeiroDia: string; // YYYY-MM-01
  ultimoDia: string; // YYYY-MM-DD (último dia real)
  chave: string; // YYYY-MM
  label: string; // "Agosto 2026"
};

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ultimoDiaMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Returns today's date as YYYY-MM-DD using America/Sao_Paulo timezone. */
export function hojeISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function mesAtual(): MesRef {
  const hoje = hojeISO(); // "YYYY-MM-DD"
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  return buildMes(ano, mes);
}

export function buildMes(ano: number, mes: number): MesRef {
  const ud = ultimoDiaMes(ano, mes);
  const chave = `${ano}-${pad2(mes)}`;
  return {
    ano,
    mes,
    primeiroDia: `${chave}-01`,
    ultimoDia: `${chave}-${pad2(ud)}`,
    chave,
    label: `${MESES_PT[mes - 1]} ${ano}`,
  };
}

export function parseMesParam(mesParam: string | undefined): MesRef {
  if (!mesParam) return mesAtual();
  const m = /^(\d{4})-(\d{2})$/.exec(mesParam);
  if (!m) return mesAtual();
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return mesAtual();
  return buildMes(ano, mes);
}

export function mesAnterior(ref: MesRef): MesRef {
  if (ref.mes === 1) return buildMes(ref.ano - 1, 12);
  return buildMes(ref.ano, ref.mes - 1);
}

export function mesProximo(ref: MesRef): MesRef {
  if (ref.mes === 12) return buildMes(ref.ano + 1, 1);
  return buildMes(ref.ano, ref.mes + 1);
}

/**
 * Qualquer cadastro que vale por um período: renda fixa, conta recorrente,
 * assinatura de cartão.
 */
export type ComVigencia = {
  inicio_vigencia: string;
  fim_vigencia: string | null;
};

/**
 * O item vale no mês quando as duas faixas se sobrepõem — começou até o
 * último dia do mês e não terminou antes do primeiro.
 *
 * A comparação é de string ISO, que ordena igual à data. A mesma expressão
 * estava escrita à mão no dashboard, no cálculo da sobra e no relatório de
 * assinaturas; um erro de sinal em uma delas fazia telas discordarem sobre o
 * mesmo mês.
 */
export function vigenteNoMes(item: ComVigencia, mes: MesRef): boolean {
  return (
    item.inicio_vigencia <= mes.ultimoDia &&
    (item.fim_vigencia === null || item.fim_vigencia >= mes.primeiroDia)
  );
}

/** Primeiro dia do mês de um `<input type="month">` ("2026-10" → "2026-10-01"). */
export function primeiroDiaDoMes(chave: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(chave);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${chave}-01`;
}

/** Último dia do mês de um `<input type="month">` ("2026-10" → "2026-10-31"). */
export function ultimoDiaDoMes(chave: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(chave);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${chave}-${pad2(ultimoDiaMes(ano, mes))}`;
}

/** Data ISO → chave de `<input type="month">` ("2026-10-01" → "2026-10"). */
export function chaveDoMes(iso: string): string {
  return iso.slice(0, 7);
}
