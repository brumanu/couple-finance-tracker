// Tipos + sentinelas de client-safe. O fetch server-side vive em
// `categorias-server.ts` — sem essa separação, importar o tipo num
// client component arrasta `next/headers` pra dentro do bundle do browser.

export type CategoriaOpcao = {
  id: string;
  nome: string;
  cor: string;
  emoji: string | null;
};

/**
 * Sentinela usada em Selects controlados quando o valor é "nenhuma
 * categoria" — Base UI Select não gosta de string vazia.
 */
export const NENHUMA_CATEGORIA = "__nenhuma__";
