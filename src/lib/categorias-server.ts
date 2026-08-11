import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaOpcao } from "@/lib/categorias";

/**
 * Retorna todas as categorias do casal, ordenadas por nome. Memoizado
 * por request via React.cache — várias telas populam o mesmo Select
 * sem re-queryar.
 */
export const getCategorias = cache(async (): Promise<CategoriaOpcao[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categorias")
    .select("id, nome, cor, emoji")
    .order("nome", { ascending: true });
  return (data ?? []) as CategoriaOpcao[];
});

/**
 * Dado um categoria_id (uuid ou vazio), retorna { categoria_id, categoria }
 * pra plugar direto no insert/update. Faz 1 query de lookup pra pegar o
 * nome canônico e mantém a coluna text legada sincronizada.
 *
 * Retorna string com mensagem se o id foi fornecido mas não achou (id
 * inválido / não pertence ao casal). Retorna { categoria_id: null,
 * categoria: null } quando raw está vazio.
 */
export async function resolverCategoria(
  supabase: SupabaseClient,
  raw: string | null | undefined,
): Promise<{ categoria_id: string | null; categoria: string | null } | string> {
  const id = (raw ?? "").trim();
  if (!id) return { categoria_id: null, categoria: null };

  const { data, error } = await supabase
    .from("categorias")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "Categoria inválida.";
  return { categoria_id: data.id, categoria: data.nome };
}
