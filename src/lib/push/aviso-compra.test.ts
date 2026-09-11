import { describe, expect, it } from "vitest";
import { destinatarios, montarAvisoDeCompra } from "./aviso-compra";

describe("montarAvisoDeCompra", () => {
  it("compra no cartão: quem lançou, descrição, valor total e link do cartão", () => {
    const aviso = montarAvisoDeCompra("Jacqueline", {
      tipo: "cartao",
      cartaoId: "nubank",
      descricao: "Farmácia",
      valor: 89.9,
    });
    expect(aviso.title).toBe("Jacqueline lançou");
    expect(aviso.body).toMatch(/^Farmácia — R\$\s89,90$/);
    expect(aviso.url).toBe("/cartoes/nubank");
  });

  it("despesa avulsa abre a tela de despesas", () => {
    const aviso = montarAvisoDeCompra("Bruno", {
      tipo: "despesa",
      descricao: "Padaria",
      valor: 18,
    });
    expect(aviso.title).toBe("Bruno lançou");
    expect(aviso.body).toMatch(/^Padaria — R\$\s18,00$/);
    expect(aviso.url).toBe("/despesas");
  });
});

describe("destinatarios", () => {
  const inscricoes = [
    { id: "iphone-jac", profile_id: "jac" },
    { id: "android-bruno", profile_id: "bruno" },
    { id: "pc-bruno", profile_id: "bruno" },
  ];

  it("tira todos os aparelhos de quem lançou", () => {
    expect(destinatarios(inscricoes, "bruno").map((s) => s.id)).toEqual(["iphone-jac"]);
  });

  it("sem aparelho do outro, ninguém recebe", () => {
    expect(destinatarios(inscricoes.slice(1), "bruno")).toEqual([]);
  });
});
