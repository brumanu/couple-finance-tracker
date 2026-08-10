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

export function mesAtual(): MesRef {
  const now = new Date();
  return buildMes(now.getFullYear(), now.getMonth() + 1);
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
