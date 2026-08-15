import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { QUEM_CASAL, type MembroOpcao } from "@/lib/membros";

/**
 * Retorna os dois membros do casal (id, nome), ordenados por nome.
 * RLS de `profiles` já restringe ao próprio casal — sem filtro
 * explícito por casal_id necessário. Memoizado por request.
 */
export const getMembrosCasal = cache(async (): Promise<MembroOpcao[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome")
    .order("nome", { ascending: true });
  return (data ?? []) as MembroOpcao[];
});

/**
 * Dado um `quem_gastou` bruto (uuid de profile, "casal", ou vazio),
 * valida e retorna { quem_gastou } pronto pra plugar no insert/update.
 * Retorna string com mensagem de erro se o uuid não for de um profile
 * válido (RLS garante que só acha profiles do próprio casal).
 */
export async function resolverQuemGastou(
  supabase: SupabaseClient,
  raw: string | null | undefined,
): Promise<{ quem_gastou: string | null } | string> {
  const v = (raw ?? "").trim();
  if (!v) return { quem_gastou: null };
  if (v === QUEM_CASAL) return { quem_gastou: QUEM_CASAL };

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", v)
    .maybeSingle();
  if (error) return error.message;
  if (!data) return "Quem gastou inválido.";
  return { quem_gastou: v };
}
