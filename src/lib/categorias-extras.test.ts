import { describe, expect, it } from "vitest";
import {
  FILTRO_SEM_CATEGORIA,
  SELECAO_VAZIA,
  desmarcarCategoria,
  marcarCategoria,
  passaNoFiltroDeCategorias,
  selecaoDaLinha,
  tornarPrincipal,
} from "./categorias-extras";

describe("marcarCategoria", () => {
  it("a primeira marcada vira a principal", () => {
    expect(marcarCategoria(SELECAO_VAZIA, "mercado")).toEqual({
      principal: "mercado",
      extras: [],
    });
  });

  it("as seguintes entram como extras, na ordem", () => {
    let sel = marcarCategoria(SELECAO_VAZIA, "mercado");
    sel = marcarCategoria(sel, "lazer");
    sel = marcarCategoria(sel, "casa");
    expect(sel).toEqual({ principal: "mercado", extras: ["lazer", "casa"] });
  });

  it("marcar de novo não duplica", () => {
    const sel = { principal: "mercado", extras: ["lazer"] };
    expect(marcarCategoria(sel, "mercado")).toBe(sel);
    expect(marcarCategoria(sel, "lazer")).toBe(sel);
  });
});

describe("desmarcarCategoria", () => {
  it("tirar a principal passa a estrela pra primeira extra", () => {
    const sel = { principal: "mercado", extras: ["lazer", "casa"] };
    expect(desmarcarCategoria(sel, "mercado")).toEqual({
      principal: "lazer",
      extras: ["casa"],
    });
  });

  it("tirar a única categoria volta pra sem categoria", () => {
    expect(
      desmarcarCategoria({ principal: "mercado", extras: [] }, "mercado"),
    ).toEqual(SELECAO_VAZIA);
  });

  it("tirar uma extra mantém a principal", () => {
    const sel = { principal: "mercado", extras: ["lazer", "casa"] };
    expect(desmarcarCategoria(sel, "lazer")).toEqual({
      principal: "mercado",
      extras: ["casa"],
    });
  });

  it("desmarcar o que não está marcado não muda nada", () => {
    const sel = { principal: "mercado", extras: [] };
    expect(desmarcarCategoria(sel, "lazer")).toBe(sel);
  });
});

describe("tornarPrincipal", () => {
  it("troca a estrela e a antiga principal vira a primeira extra", () => {
    const sel = { principal: "mercado", extras: ["lazer", "casa"] };
    expect(tornarPrincipal(sel, "casa")).toEqual({
      principal: "casa",
      extras: ["mercado", "lazer"],
    });
  });

  it("estrela numa desmarcada marca ela como principal", () => {
    const sel = { principal: "mercado", extras: [] };
    expect(tornarPrincipal(sel, "lazer")).toEqual({
      principal: "lazer",
      extras: ["mercado"],
    });
  });

  it("estrela sem nada marcado só marca", () => {
    expect(tornarPrincipal(SELECAO_VAZIA, "lazer")).toEqual({
      principal: "lazer",
      extras: [],
    });
  });

  it("estrela na que já é principal não muda nada", () => {
    const sel = { principal: "mercado", extras: ["lazer"] };
    expect(tornarPrincipal(sel, "mercado")).toBe(sel);
  });
});

describe("passaNoFiltroDeCategorias", () => {
  it("nada marcado deixa tudo passar", () => {
    expect(passaNoFiltroDeCategorias([], [])).toBe(true);
    expect(passaNoFiltroDeCategorias([], ["mercado"])).toBe(true);
  });

  it("passa com pelo menos uma das marcadas, principal ou extra", () => {
    expect(passaNoFiltroDeCategorias(["lazer"], ["mercado", "lazer"])).toBe(true);
    expect(passaNoFiltroDeCategorias(["casa", "mercado"], ["mercado"])).toBe(true);
    expect(passaNoFiltroDeCategorias(["casa"], ["mercado", "lazer"])).toBe(false);
  });

  it("\"Sem categoria\" pega só linha sem nenhuma", () => {
    expect(passaNoFiltroDeCategorias([FILTRO_SEM_CATEGORIA], [])).toBe(true);
    expect(passaNoFiltroDeCategorias([FILTRO_SEM_CATEGORIA], ["mercado"])).toBe(false);
  });

  it("\"Sem categoria\" junto com outra soma as duas fatias", () => {
    const sel = [FILTRO_SEM_CATEGORIA, "lazer"];
    expect(passaNoFiltroDeCategorias(sel, [])).toBe(true);
    expect(passaNoFiltroDeCategorias(sel, ["lazer"])).toBe(true);
    expect(passaNoFiltroDeCategorias(sel, ["mercado"])).toBe(false);
  });
});

describe("selecaoDaLinha", () => {
  it("abre a edição com a principal e as extras do banco", () => {
    expect(
      selecaoDaLinha({
        categoria_id: "mercado",
        categorias_extras: [{ categoria_id: "lazer" }, { categoria_id: "mercado" }],
      }),
    ).toEqual({ principal: "mercado", extras: ["lazer"] });
  });

  it("linha sem categoria abre vazia, mesmo com extra perdida no banco", () => {
    expect(
      selecaoDaLinha({
        categoria_id: null,
        categorias_extras: [{ categoria_id: "lazer" }],
      }),
    ).toEqual(SELECAO_VAZIA);
  });
});
