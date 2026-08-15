// Tipos + sentinelas client-safe pro seletor "quem gastou" — mesma
// separação de categorias.ts/categorias-server.ts (evita arrastar
// next/headers pro bundle do browser).

export type MembroOpcao = {
  id: string;
  nome: string;
};

/** Valor gravado em `quem_gastou` quando o gasto é do casal, não de um dos dois. */
export const QUEM_CASAL = "casal";

/** Sentinela do Select controlado quando "não especificado" (nenhum dos dois nem casal). */
export const NENHUM_QUEM = "__nenhum_quem__";
