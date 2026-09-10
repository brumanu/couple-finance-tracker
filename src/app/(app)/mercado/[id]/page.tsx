import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, PackageXIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";

export const metadata: Metadata = { title: "Compra do mercado" };

function formatData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Uma compra finalizada, só leitura.
 *
 * A lista aberta vive em `/mercado` e é interativa; aqui não há gesto nenhum —
 * é registro do que aconteceu, no mesmo espírito de `cartoes/[id]`.
 */
export default async function ListaMercadoPage({
  params,
}: PageProps<"/mercado/[id]">) {
  const supabase = await createClient();
  const { id } = await params;

  const [, listaRes] = await Promise.all([
    requireSession(),
    supabase
      .from("listas_mercado")
      .select("id, status, finalizada_em, total, lancamento_id, compra_cartao_id")
      .eq("id", id)
      .maybeSingle(),
  ]);

  const lista = listaRes.data;
  if (!lista) notFound();

  // Lista ainda aberta não tem o que mostrar aqui: ela é a tela principal.
  if (lista.status === "aberta") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-8">
        <p className="text-sm text-muted-foreground">
          Esta lista ainda está aberta.
        </p>
        <Button
          nativeButton={false}
          className="self-start"
          render={<Link href="/mercado">Abrir a lista</Link>}
        />
      </div>
    );
  }

  const { data: itens } = await supabase
    .from("itens_lista_mercado")
    .select("id, nome, quantidade, preco, status")
    .eq("lista_id", lista.id)
    .order("ordem", { ascending: true });

  const todos = itens ?? [];
  const levados = todos.filter((i) => i.status === "carrinho");
  const faltaram = todos.filter((i) => i.status === "nao_encontrado");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/mercado/historico">
              <ArrowLeftIcon className="size-4" strokeWidth={2.75} />
              Compras anteriores
            </Link>
          }
        />
        <h2 className="mt-2 font-heading text-3xl leading-tight md:text-[34px]">
          {lista.finalizada_em ? formatData(lista.finalizada_em) : "Compra"}
        </h2>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total da compra
            </p>
            <p className="mt-1 font-heading text-3xl">
              {formatBRL(lista.total)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {levados.length} {levados.length === 1 ? "item" : "itens"} no
            carrinho
            {faltaram.length > 0 && ` · ${faltaram.length} não encontrados`}
          </p>
        </div>
      </Card>

      {levados.length > 0 && (
        <Grupo
          titulo="Levados"
          icone={<CheckIcon className="size-3.5" />}
          itens={levados}
        />
      )}

      {faltaram.length > 0 && (
        <Grupo
          titulo="Não encontrados"
          icone={<PackageXIcon className="size-3.5" />}
          itens={faltaram}
          aviso="Estes foram pra próxima lista se você marcou no fechamento."
        />
      )}
    </div>
  );
}

function Grupo({
  titulo,
  icone,
  itens,
  aviso,
}: {
  titulo: string;
  icone: React.ReactNode;
  itens: {
    id: string;
    nome: string;
    quantidade: string | null;
    preco: number | string | null;
  }[];
  aviso?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icone}
        {titulo}
      </h3>
      {aviso && <p className="text-xs text-muted-foreground">{aviso}</p>}
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
        {itens.map((i) => (
          <li
            key={i.id}
            className="flex items-center gap-3 bg-card px-4 py-3 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">
              {i.nome}
              {i.quantidade && (
                <span className="ml-2 text-muted-foreground">
                  {i.quantidade}
                </span>
              )}
            </span>
            {i.preco != null && (
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatBRL(i.preco)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
