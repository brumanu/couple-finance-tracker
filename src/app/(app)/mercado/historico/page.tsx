import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";

export const metadata: Metadata = { title: "Compras anteriores" };

/** Quantas compras a tela lista. Além disso vira arqueologia, não consulta. */
const LIMITE = 50;

function formatData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function HistoricoMercadoPage() {
  const supabase = await createClient();

  const [, listasRes] = await Promise.all([
    requireSession(),
    supabase
      .from("listas_mercado")
      .select("id, finalizada_em, total")
      .eq("status", "finalizada")
      .order("finalizada_em", { ascending: false })
      .limit(LIMITE),
  ]);

  const listas = listasRes.data ?? [];

  // Uma query só pros itens de todas as listas da página, em vez de uma por
  // linha da tela.
  const ids = listas.map((l) => l.id);
  const { data: itens } = ids.length
    ? await supabase
        .from("itens_lista_mercado")
        .select("lista_id, status")
        .in("lista_id", ids)
    : { data: [] };

  const porLista = new Map<string, { levados: number; faltaram: number }>();
  for (const item of itens ?? []) {
    const atual = porLista.get(item.lista_id) ?? { levados: 0, faltaram: 0 };
    if (item.status === "carrinho") atual.levados++;
    else if (item.status === "nao_encontrado") atual.faltaram++;
    porLista.set(item.lista_id, atual);
  }

  const totalGasto = listas.reduce((s, l) => s + Number(l.total ?? 0), 0);
  const media = listas.length > 0 ? totalGasto / listas.length : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/mercado">
              <ArrowLeftIcon className="size-4" strokeWidth={2.75} />
              Voltar
            </Link>
          }
        />
        <h2 className="mt-2 font-heading text-3xl leading-tight md:text-[34px]">
          Compras anteriores
        </h2>
        {listas.length > 0 && (
          <p className="mt-1.5 text-[15px] text-neutral-700">
            {listas.length}{" "}
            {listas.length === 1 ? "ida ao mercado" : "idas ao mercado"} · média
            de {formatBRL(media)} por compra
          </p>
        )}
      </div>

      {listas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
          Nenhuma compra finalizada ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
          {listas.map((l) => {
            const contagem = porLista.get(l.id) ?? { levados: 0, faltaram: 0 };
            return (
              <li key={l.id}>
                <Link
                  href={`/mercado/${l.id}`}
                  className="flex items-center gap-3 bg-card px-4 py-4 transition-colors hover:bg-foreground/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {l.finalizada_em ? formatData(l.finalizada_em) : "—"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {contagem.levados}{" "}
                      {contagem.levados === 1 ? "item" : "itens"}
                      {contagem.faltaram > 0 &&
                        ` · ${contagem.faltaram} não ${contagem.faltaram === 1 ? "encontrado" : "encontrados"}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg tabular-nums">
                    {formatBRL(l.total)}
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
