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
