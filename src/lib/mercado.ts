/**
 * Lógica pura da lista de mercado — sem React, sem Supabase, sem `window`.
 *
 * Estas três funções são as que erram calado: um parser que interpreta
 * demais, um merge que descarta a intenção do usuário, uma soma que
 * preenche um campo de dinheiro com número errado. São elas que o
 * `mercado.test.ts` cobre; o resto da feature se confere olhando a tela.
 */

export type StatusItem = "pendente" | "carrinho" | "nao_encontrado";

export type ItemMercado = {
  id: string;
  nome: string;
  quantidade: string | null;
  preco: number | null;
  status: StatusItem;
  faltou_antes: boolean;
  ordem: number;
};

/** Campos que a fila de sincronização sabe alterar num item já existente. */
export type MudancaItem = {
  nome?: string;
  quantidade?: string | null;
  preco?: number | null;
  status?: StatusItem;
  ordem?: number;
  /** Item criado no cliente e ainda não enviado. */
  novo?: boolean;
  /** Item removido no cliente e ainda não enviado. */
  removido?: boolean;
};

export type FilaMercado = Record<string, MudancaItem>;

// ---------------------------------------------------------------------
// Normalização de nome
// ---------------------------------------------------------------------

/**
 * Forma canônica pra comparar nomes de item: minúsculas, sem acento, sem
 * espaço sobrando. "Café", "cafe " e "CAFÉ" são o mesmo item — no corredor,
 * duplicata é sempre engano de digitação, nunca intenção.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    // `\p{Diacritic}` em vez da faixa U+0300–U+036F escrita à mão: os
    // caracteres combinantes literais são invisíveis no editor e viram lixo
    // em qualquer diff.
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------
// Parser do bloco de itens
// ---------------------------------------------------------------------

/**
 * Unidades que o parser aceita ao separar quantidade de nome. A lista é
 * curta de propósito: quanto mais ela cresce, mais nome de produto vira
 * quantidade por engano ("suco de caju **l**ata").
 */
const UNIDADES = ["kg", "g", "l", "ml", "un", "pct", "cx", "dz"] as const;

const UNIDADES_RE = UNIDADES.join("|");

/** "2x arroz" / "2 x arroz" — multiplicador antes do nome. */
const MULTIPLICADOR_ANTES = new RegExp(`^(\\d{1,3})\\s*x\\s+(.+)$`, "i");

/** "arroz 2x" — multiplicador depois do nome. */
const MULTIPLICADOR_DEPOIS = new RegExp(`^(.+?)\\s+(\\d{1,3})\\s*x$`, "i");

/** "arroz 5kg" — número + unidade conhecida no fim. */
const UNIDADE_DEPOIS = new RegExp(
  `^(.+?)\\s+(\\d{1,4}(?:[.,]\\d{1,3})?)\\s*(${UNIDADES_RE})$`,
  "i",
);

export type ItemParseado = { nome: string; quantidade: string | null };

/**
 * Separa nome e quantidade de uma linha digitada.
 *
 * Deliberadamente conservador: só reconhece as três formas acima e, em
 * qualquer outro caso, devolve a frase inteira como nome. Um parser esperto
 * que erra é pior que um bobo que acerta — ler "Arroz" na lista e não fazer
 * ideia de por que virou 5 unidades destrói a confiança na tela.
 */
export function parseItem(linha: string): ItemParseado | null {
  const bruto = linha.trim().replace(/\s+/g, " ");
  if (!bruto) return null;

  const antes = MULTIPLICADOR_ANTES.exec(bruto);
  if (antes) {
    return { nome: antes[2].trim(), quantidade: `${antes[1]}x` };
  }

  const depois = MULTIPLICADOR_DEPOIS.exec(bruto);
  if (depois) {
    return { nome: depois[1].trim(), quantidade: `${depois[2]}x` };
  }

  const unidade = UNIDADE_DEPOIS.exec(bruto);
  if (unidade) {
    return {
      nome: unidade[1].trim(),
      quantidade: `${unidade[2]}${unidade[3].toLowerCase()}`,
    };
  }

  return { nome: bruto, quantidade: null };
}

/**
 * Lê o textarea de cadastro em massa.
 *
 * Quebra por linha e por vírgula, descarta o que ficou vazio e colapsa
 * repetidos (pelo nome normalizado) preservando a primeira ocorrência — que
 * é a que carrega a quantidade que o usuário digitou primeiro.
 *
 * `jaNaLista` são os nomes já presentes: itens que colidem com eles saem do
 * resultado, porque o bloco costuma ser colado por cima de uma lista que já
 * tem coisa dentro.
 */
export function parseBlocoDeItens(
  texto: string,
  jaNaLista: readonly string[] = [],
): ItemParseado[] {
  const vistos = new Set(jaNaLista.map(normalizarNome));
  const saida: ItemParseado[] = [];

  for (const linha of texto.split(/[\n,;]/)) {
    const item = parseItem(linha);
    if (!item) continue;

    const chave = normalizarNome(item.nome);
    if (!chave || vistos.has(chave)) continue;

    vistos.add(chave);
    saida.push(item);
  }

  return saida;
}

// ---------------------------------------------------------------------
// Merge da fila local com o que veio do servidor
// ---------------------------------------------------------------------

/**
 * Aplica a fila de mudanças não-enviadas sobre os itens que o servidor
 * devolveu.
 *
 * A regra é uma só: **a fila ganha nos itens que ela toca**, o servidor ganha
 * no resto. A fila é intenção do usuário que ainda não subiu — se o servidor
 * sobrescrevesse, o toque dado no corredor sem sinal simplesmente sumiria da
 * tela quando a conexão voltasse.
 *
 * Itens marcados `novo` que o servidor ainda não conhece são acrescentados;
 * itens marcados `removido` somem mesmo que o servidor ainda os liste.
 */
export function aplicarFilaLocal(
  doServidor: readonly ItemMercado[],
  fila: FilaMercado,
): ItemMercado[] {
  const pendentes = new Set(Object.keys(fila));
  const saida: ItemMercado[] = [];

  for (const item of doServidor) {
    const mudanca = fila[item.id];
    pendentes.delete(item.id);

    if (!mudanca) {
      saida.push(item);
      continue;
    }
    if (mudanca.removido) continue;

    saida.push({
      ...item,
      ...(mudanca.nome !== undefined && { nome: mudanca.nome }),
      ...(mudanca.quantidade !== undefined && { quantidade: mudanca.quantidade }),
      ...(mudanca.preco !== undefined && { preco: mudanca.preco }),
      ...(mudanca.status !== undefined && { status: mudanca.status }),
      ...(mudanca.ordem !== undefined && { ordem: mudanca.ordem }),
    });
  }

  // Sobrou na fila o que o servidor ainda não conhece: os itens criados
  // offline. Os que não são `novo` são fantasmas (o outro celular apagou),
  // e some com eles em silêncio.
  for (const id of pendentes) {
    const mudanca = fila[id];
    if (!mudanca.novo || mudanca.removido) continue;
    saida.push({
      id,
      nome: mudanca.nome ?? "",
      quantidade: mudanca.quantidade ?? null,
      preco: mudanca.preco ?? null,
      status: mudanca.status ?? "pendente",
      faltou_antes: false,
      ordem: mudanca.ordem ?? 0,
    });
  }

  return saida.sort((a, b) => a.ordem - b.ordem);
}

// ---------------------------------------------------------------------
// Total sugerido no fechamento
// ---------------------------------------------------------------------

export type TotalSugerido =
  | { tipo: "completo"; valor: number }
  | { tipo: "parcial"; valor: number; comPreco: number; total: number }
  | { tipo: "nenhum" };

/**
 * Decide o que o campo "quanto deu" mostra ao abrir o fechamento.
 *
 * - Todos os itens do carrinho com preço → soma vira o valor do campo.
 * - Só alguns com preço → **não preenche nada**; devolve a soma parcial só
 *   pra tela mostrar como referência. Preencher o campo com uma soma
 *   incompleta é pior que deixar vazio: o usuário confirma sem reparar e a
 *   despesa entra menor do que foi.
 * - Nenhum → nada.
 *
 * Itens fora do carrinho são ignorados: não foram pagos.
 */
export function calcularTotalSugerido(
  itens: readonly ItemMercado[],
): TotalSugerido {
  const noCarrinho = itens.filter((i) => i.status === "carrinho");
  if (noCarrinho.length === 0) return { tipo: "nenhum" };

  const comPreco = noCarrinho.filter((i) => i.preco != null && i.preco > 0);
  if (comPreco.length === 0) return { tipo: "nenhum" };

  const soma = comPreco.reduce((s, i) => s + Number(i.preco), 0);
  // Arredonda pra centavo: somar floats de 30 preços acumula resíduo.
  const valor = Math.round(soma * 100) / 100;

  if (comPreco.length === noCarrinho.length) {
    return { tipo: "completo", valor };
  }

  return {
    tipo: "parcial",
    valor,
    comPreco: comPreco.length,
    total: noCarrinho.length,
  };
}

// ---------------------------------------------------------------------
// Auxiliares de tela
// ---------------------------------------------------------------------

/** Rótulo do contador do topo: "12 de 30 no carrinho". */
export function contarProgresso(itens: readonly ItemMercado[]): {
  carrinho: number;
  naoEncontrados: number;
  pendentes: number;
  total: number;
} {
  let carrinho = 0;
  let naoEncontrados = 0;
  for (const i of itens) {
    if (i.status === "carrinho") carrinho++;
    else if (i.status === "nao_encontrado") naoEncontrados++;
  }
  return {
    carrinho,
    naoEncontrados,
    pendentes: itens.length - carrinho - naoEncontrados,
    total: itens.length,
  };
}

/**
 * Sugestões do campo de adicionar item, filtradas no cliente.
 *
 * O histórico inteiro chega uma vez quando a tela abre — digitar não pode
 * ir ao servidor numa tela que precisa funcionar com sinal ruim.
 */
export function filtrarSugestoes(
  historico: readonly string[],
  termo: string,
  jaNaLista: readonly string[],
  limite = 6,
): string[] {
  const alvo = normalizarNome(termo);
  if (!alvo) return [];

  const excluir = new Set(jaNaLista.map(normalizarNome));
  const comeca: string[] = [];
  const contem: string[] = [];

  for (const nome of historico) {
    const chave = normalizarNome(nome);
    if (excluir.has(chave) || chave === alvo) continue;
    if (chave.startsWith(alvo)) comeca.push(nome);
    else if (chave.includes(alvo)) contem.push(nome);
    if (comeca.length >= limite) break;
  }

  return [...comeca, ...contem].slice(0, limite);
}
