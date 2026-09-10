/**
 * Categorias extras — a parte client-safe.
 *
 * `categoria_id` é a categoria PRINCIPAL e continua sendo a única que os
 * relatórios de soma agrupam. As extras (migration 0017) só classificam e
 * filtram. Quem grava é `sincronizarCategoriasExtras` em `acoes.ts`; aqui
 * ficam só constante, tipo e leitura — sem nada que arraste `next/headers`
 * pro bundle do browser.
 */

/**
 * Nome do campo no formulário. O multi-select emite um `<input hidden>` por
 * categoria escolhida, todos com este nome, e o servidor lê com `getAll` —
 * assim ninguém precisa inventar (nem escapar) um separador.
 */
export const CAMPO_CATEGORIAS_EXTRAS = "categorias_extras";

/**
 * O formato em que as extras chegam do PostgREST. As consultas pedem
 * `categorias_extras(categoria_id)` embutido, então elas vêm junto da linha,
 * sem consulta separada.
 */
export type ExtraDeCategoria = { categoria_id: string };

/** Linha de qualquer tabela que participe das extras. */
export type ComExtras = {
  categoria_id: string | null;
  categorias_extras?: ExtraDeCategoria[] | null;
};

/** Só os ids das extras, sem a principal. */
export function idsDeExtras(linha: ComExtras | null | undefined): string[] {
  if (!linha?.categorias_extras) return [];
  return linha.categorias_extras
    .map((e) => e.categoria_id)
    .filter((id) => id !== linha.categoria_id);
}

// ------------------------------------------------------------------
// Seleção no formulário: um campo só, com a principal marcada por estrela
// ------------------------------------------------------------------

/**
 * O que o campo "Categorias" do formulário guarda. `principal` é a da
 * estrela — vira `categoria_id` —, `extras` são as demais marcadas. Nada
 * marcado = sem categoria.
 */
export type SelecaoCategorias = {
  principal: string | null;
  extras: string[];
};

export const SELECAO_VAZIA: SelecaoCategorias = { principal: null, extras: [] };

/** Estado inicial do campo pra editar uma linha que já existe. */
export function selecaoDaLinha(
  linha: ComExtras | null | undefined,
): SelecaoCategorias {
  if (!linha?.categoria_id) return SELECAO_VAZIA;
  return { principal: linha.categoria_id, extras: idsDeExtras(linha) };
}

/**
 * Marca uma categoria. A primeira marcada já vira a principal: a maioria das
 * compras tem uma categoria só, e exigir o toque na estrela nelas seria um
 * passo a mais sem motivo.
 */
export function marcarCategoria(
  sel: SelecaoCategorias,
  id: string,
): SelecaoCategorias {
  if (sel.principal === id || sel.extras.includes(id)) return sel;
  if (!sel.principal) return { principal: id, extras: sel.extras };
  return { principal: sel.principal, extras: [...sel.extras, id] };
}

/**
 * Desmarca. Se era a principal, a estrela passa pra primeira extra — sem
 * principal, as extras ficariam exibidas na lista enquanto a compra conta
 * como "sem categoria" nas somas.
 */
export function desmarcarCategoria(
  sel: SelecaoCategorias,
  id: string,
): SelecaoCategorias {
  if (sel.principal === id) {
    const [proxima = null, ...resto] = sel.extras;
    return { principal: proxima, extras: resto };
  }
  if (!sel.extras.includes(id)) return sel;
  return { principal: sel.principal, extras: sel.extras.filter((e) => e !== id) };
}

/**
 * Põe a estrela numa categoria — marcando-a, se ainda não estava. A antiga
 * principal continua marcada, agora como extra, no começo da lista.
 */
export function tornarPrincipal(
  sel: SelecaoCategorias,
  id: string,
): SelecaoCategorias {
  if (sel.principal === id) return sel;
  const extras = sel.extras.filter((e) => e !== id);
  return {
    principal: id,
    extras: sel.principal ? [sel.principal, ...extras] : extras,
  };
}

// ------------------------------------------------------------------
// Filtro de categorias dos relatórios
// ------------------------------------------------------------------

/** Valor da opção "Sem categoria" nos filtros — não é id de categoria. */
export const FILTRO_SEM_CATEGORIA = "__sem_cat__";

/**
 * A linha passa no filtro se tiver PELO MENOS UMA das categorias marcadas.
 * Nada marcado = sem filtro. `idsDaLinha` decide o que conta: nos relatórios
 * que listam compras é `categoriasDaLinha` (principal e extras); nos que
 * somam, só a principal — senão a mesma compra entraria duas vezes no total.
 */
export function passaNoFiltroDeCategorias(
  selecionadas: string[],
  idsDaLinha: string[],
): boolean {
  if (selecionadas.length === 0) return true;
  if (selecionadas.includes(FILTRO_SEM_CATEGORIA) && idsDaLinha.length === 0) {
    return true;
  }
  return idsDaLinha.some((id) => selecionadas.includes(id));
}

/**
 * Todas as categorias de uma linha, principal primeiro.
 *
 * É este conjunto que o filtro do relatório usa: "tem pelo menos uma das
 * marcadas" e "tem todas as marcadas" olham aqui, não só a principal.
 */
export function categoriasDaLinha(
  linha: ComExtras | null | undefined,
): string[] {
  if (!linha) return [];
  const ids = linha.categoria_id ? [linha.categoria_id] : [];
  for (const id of idsDeExtras(linha)) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}
