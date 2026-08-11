import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CartaoOpcao = {
  id: string;
  label: string; // "Banco · Apelido" ou só "Banco"
  bancoIcone: string | null;
  bancoCor: string;
  bancoNome: string;
};

/**
 * Retorna cartões ativos com o nome amigável pra usar em selects
 * (dialog de despesa, por exemplo). Memoizado por request via
 * React.cache: várias chamadas na mesma request compartilham 1 query.
 */
export const getCartoesParaSelecao = cache(async (): Promise<CartaoOpcao[]> => {
  const supabase = await createClient();
  const { data: cartoes } = await supabase
    .from("cartoes")
    .select("id, banco_id, apelido")
    .eq("ativo", true)
    .order("apelido", { ascending: true });

  const lista = cartoes ?? [];
  if (lista.length === 0) return [];

  const bancoIds = Array.from(new Set(lista.map((c) => c.banco_id)));
  const { data: bancos } = await supabase
    .from("bancos")
    .select("id, nome, cor, icone")
    .in("id", bancoIds);
  const bancoById = new Map(
    (bancos ?? []).map((b) => [b.id, b] as const),
  );

  return lista.map((c) => {
    const banco = bancoById.get(c.banco_id);
    const label = banco?.nome
      ? c.apelido
        ? `${banco.nome} · ${c.apelido}`
        : banco.nome
      : (c.apelido ?? "Cartão");
    return {
      id: c.id,
      label,
      bancoIcone: banco?.icone ?? null,
      bancoCor: banco?.cor ?? "#c67139",
      bancoNome: banco?.nome ?? label,
    };
  });
});
