import { describe, expect, it } from "vitest";
import type { AssinaturaCartaoInfo } from "./cartao-calc";
import {
  montarLembretes,
  proximoVencimento,
  type CartaoParaLembrete,
  type ContaParaLembrete,
  type DadosDoCasal,
} from "./lembretes";

function conta(dia: number, extra: Partial<ContaParaLembrete> = {}): ContaParaLembrete {
  return {
    id: "luz",
    descricao: "Luz",
    valor_previsto: 180,
    dia_vencimento: dia,
    inicio_vigencia: "1900-01-01",
    fim_vigencia: null,
    ...extra,
  };
}

function cartao(dia: number): CartaoParaLembrete {
  return { id: "nubank", dia_fechamento: 1, dia_vencimento: dia, nome: "Nubank" };
}

// Assinatura cai inteira em toda fatura enquanto vigente: jeito simples de
// dar valor à fatura sem depender das regras de fechamento das compras.
const assinatura: AssinaturaCartaoInfo = {
  id: "streaming",
  cartao_id: "nubank",
  descricao: "Streaming",
  valor_mensal: 40,
  categoria: null,
  inicio_vigencia: "2026-01-01",
  fim_vigencia: null,
  ativa: true,
};

function dados(extra: Partial<DadosDoCasal> = {}): DadosDoCasal {
  return {
    contas: [],
    cartoes: [],
    compras: [],
    assinaturas: [],
    contasPagas: new Set(),
    faturasPagas: new Set(),
    ...extra,
  };
}

describe("proximoVencimento", () => {
  it("hoje conta como próximo", () => {
    expect(proximoVencimento(11, { ano: 2026, mes: 9, dia: 11 })).toEqual({
      ano: 2026,
      mes: 9,
      dia: 11,
    });
  });

  it("dia já passado vai pro mês seguinte, virando o ano em dezembro", () => {
    expect(proximoVencimento(5, { ano: 2026, mes: 12, dia: 20 })).toEqual({
      ano: 2027,
      mes: 1,
      dia: 5,
    });
  });

  it("dia 31 num mês de 30 dias cai no dia 30", () => {
    expect(proximoVencimento(31, { ano: 2026, mes: 9, dia: 29 })).toEqual({
      ano: 2026,
      mes: 9,
      dia: 30,
    });
  });
});

describe("montarLembretes — contas fixas", () => {
  it("avisa 2 dias antes, na véspera e no dia", () => {
    const hoje = "2026-09-11";
    const titulos = [13, 12, 11].map(
      (dia) => montarLembretes(dados({ contas: [conta(dia)] }), hoje)[0]?.title,
    );
    expect(titulos).toEqual([
      "Conta vence em 2 dias",
      "Conta vence amanhã",
      "Conta vence hoje",
    ]);
  });

  it("não avisa com 3 dias ou mais de antecedência", () => {
    expect(montarLembretes(dados({ contas: [conta(14)] }), "2026-09-11")).toEqual([]);
  });

  it("o corpo traz descrição e valor", () => {
    const [l] = montarLembretes(dados({ contas: [conta(11)] }), "2026-09-11");
    expect(l.body).toContain("Luz");
    expect(l.body).toContain("180,00");
    expect(l.url).toBe("/");
  });

  it("conta já paga no mês do vencimento não gera aviso", () => {
    const d = dados({ contas: [conta(12)], contasPagas: new Set(["luz|2026-09-01"]) });
    expect(montarLembretes(d, "2026-09-11")).toEqual([]);
  });

  it("vencimento no mês seguinte olha o pagamento do mês seguinte", () => {
    // Hoje 30/09, vence 01/10: pago em setembro não conta.
    const d = dados({ contas: [conta(1)], contasPagas: new Set(["luz|2026-09-01"]) });
    expect(montarLembretes(d, "2026-09-30")).toHaveLength(1);
  });

  it("conta fora da vigência não gera aviso", () => {
    const encerrada = conta(12, { fim_vigencia: "2026-08-31" });
    const futura = conta(12, { id: "gas", inicio_vigencia: "2026-10-01" });
    expect(
      montarLembretes(dados({ contas: [encerrada, futura] }), "2026-09-11"),
    ).toEqual([]);
  });

  it("conta sem dia de vencimento é ignorada", () => {
    const d = dados({ contas: [conta(11, { dia_vencimento: null })] });
    expect(montarLembretes(d, "2026-09-11")).toEqual([]);
  });
});

describe("montarLembretes — faturas", () => {
  it("avisa a fatura com valor, com link pro cartão", () => {
    const d = dados({ cartoes: [cartao(12)], assinaturas: [assinatura] });
    const [l] = montarLembretes(d, "2026-09-11");
    expect(l.title).toBe("Fatura vence amanhã");
    expect(l.body).toContain("Nubank");
    expect(l.body).toContain("40,00");
    expect(l.url).toBe("/cartoes/nubank");
  });

  it("fatura marcada como paga não gera aviso", () => {
    const d = dados({
      cartoes: [cartao(11)],
      assinaturas: [assinatura],
      faturasPagas: new Set(["nubank|2026-09-01"]),
    });
    expect(montarLembretes(d, "2026-09-11")).toEqual([]);
  });

  it("fatura zerada não gera aviso", () => {
    expect(montarLembretes(dados({ cartoes: [cartao(11)] }), "2026-09-11")).toEqual([]);
  });
});
