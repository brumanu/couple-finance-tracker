import { describe, expect, it } from "vitest";
import {
  aplicarFilaLocal,
  calcularTotalSugerido,
  contarProgresso,
  filtrarSugestoes,
  normalizarNome,
  parseBlocoDeItens,
  parseItem,
  type ItemMercado,
} from "@/lib/mercado";
import {
  mesclarMudanca,
  removerEnviados,
  separarFila,
} from "@/lib/mercado-fila";

/** Item com os campos que cada teste não usa já preenchidos. */
function item(parcial: Partial<ItemMercado> & { id: string }): ItemMercado {
  return {
    nome: "Item",
    quantidade: null,
    preco: null,
    status: "pendente",
    faltou_antes: false,
    ordem: 0,
    ...parcial,
  };
}

describe("normalizarNome", () => {
  it("iguala maiúsculas, acentos e espaço sobrando", () => {
    expect(normalizarNome("Café")).toBe("cafe");
    expect(normalizarNome("  CAFÉ  ")).toBe("cafe");
    expect(normalizarNome("Açúcar   Mascavo")).toBe("acucar mascavo");
  });
});

describe("parseItem", () => {
  it("entende multiplicador antes do nome", () => {
    expect(parseItem("2x leite")).toEqual({ nome: "leite", quantidade: "2x" });
    expect(parseItem("2 x leite")).toEqual({ nome: "leite", quantidade: "2x" });
  });

  it("entende multiplicador depois do nome", () => {
    expect(parseItem("leite 2x")).toEqual({ nome: "leite", quantidade: "2x" });
  });

  it("entende número + unidade conhecida no fim", () => {
    expect(parseItem("arroz 5kg")).toEqual({ nome: "arroz", quantidade: "5kg" });
    expect(parseItem("leite 1 L")).toEqual({ nome: "leite", quantidade: "1l" });
    expect(parseItem("carne 1,5 kg")).toEqual({
      nome: "carne",
      quantidade: "1,5kg",
    });
  });

  // O ponto do parser conservador: na dúvida ele NÃO inventa quantidade.
  it("devolve a frase inteira quando não reconhece o formato", () => {
    expect(parseItem("papel higiênico folha dupla")).toEqual({
      nome: "papel higiênico folha dupla",
      quantidade: null,
    });
    expect(parseItem("detergente 3 unidades")).toEqual({
      nome: "detergente 3 unidades",
      quantidade: null,
    });
    // "5" sozinho não é unidade conhecida — vira parte do nome.
    expect(parseItem("sabonete 5")).toEqual({
      nome: "sabonete 5",
      quantidade: null,
    });
  });

  it("ignora linha vazia", () => {
    expect(parseItem("   ")).toBeNull();
    expect(parseItem("")).toBeNull();
  });

  it("não confunde nome que termina com letra de unidade", () => {
    // "gel" termina em "l", mas não tem número antes.
    expect(parseItem("gel")).toEqual({ nome: "gel", quantidade: null });
  });
});

describe("parseBlocoDeItens", () => {
  it("quebra por linha, vírgula e ponto e vírgula", () => {
    const itens = parseBlocoDeItens("arroz\nfeijão, café; leite");
    expect(itens.map((i) => i.nome)).toEqual([
      "arroz",
      "feijão",
      "café",
      "leite",
    ]);
  });

  it("descarta linhas em branco", () => {
    const itens = parseBlocoDeItens("arroz\n\n\n   \nfeijão");
    expect(itens).toHaveLength(2);
  });

  it("colapsa repetidos preservando a primeira ocorrência", () => {
    const itens = parseBlocoDeItens("2x leite\nLeite\nLEITE 3x");
    expect(itens).toEqual([{ nome: "leite", quantidade: "2x" }]);
  });

  it("descarta o que já está na lista", () => {
    const itens = parseBlocoDeItens("arroz\ncafé\nfeijão", ["Café", "ARROZ"]);
    expect(itens.map((i) => i.nome)).toEqual(["feijão"]);
  });

  it("devolve vazio pra texto vazio", () => {
    expect(parseBlocoDeItens("")).toEqual([]);
    expect(parseBlocoDeItens("\n , ; \n")).toEqual([]);
  });
});

describe("aplicarFilaLocal", () => {
  const doServidor: ItemMercado[] = [
    item({ id: "a", nome: "Arroz", ordem: 1 }),
    item({ id: "b", nome: "Feijão", ordem: 2 }),
  ];

  it("sem fila, devolve o servidor", () => {
    expect(aplicarFilaLocal(doServidor, {})).toEqual(doServidor);
  });

  // A regra central: o toque dado sem sinal não pode sumir quando a rede volta.
  it("a fila ganha nos itens que ela toca", () => {
    const saida = aplicarFilaLocal(doServidor, { a: { status: "carrinho" } });
    expect(saida.find((i) => i.id === "a")?.status).toBe("carrinho");
    expect(saida.find((i) => i.id === "b")?.status).toBe("pendente");
  });

  it("o servidor ganha nos itens que a fila não toca", () => {
    const atualizado = [item({ id: "b", nome: "Feijão preto", ordem: 2 })];
    const saida = aplicarFilaLocal(atualizado, { a: { status: "carrinho" } });
    expect(saida.find((i) => i.id === "b")?.nome).toBe("Feijão preto");
  });

  it("acrescenta item criado offline que o servidor ainda não conhece", () => {
    const saida = aplicarFilaLocal(doServidor, {
      novo1: { novo: true, nome: "Café", ordem: 3 },
    });
    expect(saida).toHaveLength(3);
    expect(saida[2]).toMatchObject({ id: "novo1", nome: "Café" });
  });

  it("some com item removido localmente mesmo que o servidor liste", () => {
    const saida = aplicarFilaLocal(doServidor, { a: { removido: true } });
    expect(saida.map((i) => i.id)).toEqual(["b"]);
  });

  // O outro celular apagou o item; a fila local ainda tem um update dele.
  it("ignora fantasma: entrada da fila sem `novo` que o servidor não tem", () => {
    const saida = aplicarFilaLocal(doServidor, { sumido: { preco: 10 } });
    expect(saida.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("respeita a ordem", () => {
    const bagunçado = [
      item({ id: "a", ordem: 5 }),
      item({ id: "b", ordem: 1 }),
    ];
    expect(aplicarFilaLocal(bagunçado, {}).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("aceita preço e quantidade voltando a nulo", () => {
    const comPreco = [item({ id: "a", preco: 12, quantidade: "2x" })];
    const saida = aplicarFilaLocal(comPreco, {
      a: { preco: null, quantidade: null },
    });
    expect(saida[0].preco).toBeNull();
    expect(saida[0].quantidade).toBeNull();
  });
});

describe("calcularTotalSugerido", () => {
  it("soma quando todos os itens do carrinho têm preço", () => {
    const itens = [
      item({ id: "a", status: "carrinho", preco: 10.5 }),
      item({ id: "b", status: "carrinho", preco: 4.25 }),
    ];
    expect(calcularTotalSugerido(itens)).toEqual({
      tipo: "completo",
      valor: 14.75,
    });
  });

  // Preencher o campo com uma soma incompleta é pior que deixar vazio.
  it("não sugere valor quando só alguns têm preço", () => {
    const itens = [
      item({ id: "a", status: "carrinho", preco: 10 }),
      item({ id: "b", status: "carrinho" }),
    ];
    expect(calcularTotalSugerido(itens)).toEqual({
      tipo: "parcial",
      valor: 10,
      comPreco: 1,
      total: 2,
    });
  });

  it("ignora itens fora do carrinho", () => {
    const itens = [
      item({ id: "a", status: "carrinho", preco: 10 }),
      item({ id: "b", status: "nao_encontrado", preco: 99 }),
      item({ id: "c", status: "pendente", preco: 99 }),
    ];
    expect(calcularTotalSugerido(itens)).toEqual({
      tipo: "completo",
      valor: 10,
    });
  });

  it("devolve nenhum quando o carrinho está vazio ou sem preços", () => {
    expect(calcularTotalSugerido([])).toEqual({ tipo: "nenhum" });
    expect(
      calcularTotalSugerido([item({ id: "a", status: "carrinho" })]),
    ).toEqual({ tipo: "nenhum" });
  });

  it("arredonda o resíduo de somar floats", () => {
    const itens = [
      item({ id: "a", status: "carrinho", preco: 0.1 }),
      item({ id: "b", status: "carrinho", preco: 0.2 }),
    ];
    const saida = calcularTotalSugerido(itens);
    expect(saida).toEqual({ tipo: "completo", valor: 0.3 });
  });
});

describe("contarProgresso", () => {
  it("conta os três estados", () => {
    const itens = [
      item({ id: "a", status: "carrinho" }),
      item({ id: "b", status: "carrinho" }),
      item({ id: "c", status: "nao_encontrado" }),
      item({ id: "d" }),
    ];
    expect(contarProgresso(itens)).toEqual({
      carrinho: 2,
      naoEncontrados: 1,
      pendentes: 1,
      total: 4,
    });
  });
});

describe("filtrarSugestoes", () => {
  const historico = ["Leite integral", "Leite condensado", "Filé de frango"];

  it("prioriza quem começa com o termo", () => {
    expect(filtrarSugestoes(historico, "lei", [])).toEqual([
      "Leite integral",
      "Leite condensado",
    ]);
  });

  it("aceita acento e caixa diferentes", () => {
    expect(filtrarSugestoes(historico, "FILE", [])).toEqual(["Filé de frango"]);
  });

  it("esconde o que já está na lista", () => {
    expect(filtrarSugestoes(historico, "lei", ["leite integral"])).toEqual([
      "Leite condensado",
    ]);
  });

  it("devolve vazio pra termo vazio", () => {
    expect(filtrarSugestoes(historico, "  ", [])).toEqual([]);
  });
});

describe("mesclarMudanca", () => {
  it("funde mudanças do mesmo item", () => {
    let fila = mesclarMudanca({}, "a", { status: "carrinho" });
    fila = mesclarMudanca(fila, "a", { preco: 9.9 });
    expect(fila.a).toEqual({ status: "carrinho", preco: 9.9 });
  });

  // Um item criado offline e editado depois continua sendo um insert.
  it("`novo` é grudento", () => {
    let fila = mesclarMudanca({}, "n1", { novo: true, nome: "Café" });
    fila = mesclarMudanca(fila, "n1", { status: "carrinho" });
    expect(fila.n1.novo).toBe(true);
  });

  it("remover item que nunca subiu apaga a entrada", () => {
    let fila = mesclarMudanca({}, "n1", { novo: true, nome: "Café" });
    fila = mesclarMudanca(fila, "n1", { removido: true });
    expect(fila.n1).toBeUndefined();
  });

  it("remover item do servidor vira marca de removido", () => {
    const fila = mesclarMudanca({}, "a", { removido: true });
    expect(fila.a).toEqual({ removido: true });
  });
});

describe("removerEnviados", () => {
  it("limpa o que subiu igual", () => {
    const fila = { a: { status: "carrinho" as const } };
    expect(removerEnviados(fila, fila)).toEqual({});
  });

  // O usuário continuou tocando enquanto a requisição estava no ar.
  it("mantém entrada que mudou durante o envio", () => {
    const enviado = { a: { status: "carrinho" as const } };
    const atual = { a: { status: "carrinho" as const, preco: 5 } };
    expect(removerEnviados(atual, enviado)).toEqual(atual);
  });

  it("mantém entrada que nem foi enviada", () => {
    const atual = { b: { status: "pendente" as const } };
    expect(removerEnviados(atual, {})).toEqual(atual);
  });
});

describe("separarFila", () => {
  it("separa o que salva do que remove", () => {
    const { paraSalvar, paraRemover } = separarFila({
      a: { status: "carrinho" },
      b: { removido: true },
      c: { novo: true, nome: "Café" },
    });
    expect(paraSalvar.sort()).toEqual(["a", "c"]);
    expect(paraRemover).toEqual(["b"]);
  });

  it("fila vazia não gera trabalho", () => {
    expect(separarFila({})).toEqual({ paraSalvar: [], paraRemover: [] });
  });
});
