import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { PagamentoFormDialog } from "./pagamento-form-dialog";
import { PagamentoActionsMenu } from "./pagamento-actions-menu";
import { EditDividaTrigger } from "../divida-form-dialog";
import { DividaActionsMenu } from "../divida-actions-menu";

type PagamentoRow = {
  id: string;
  valor: number | string;
  data_pagamento: string;
  observacao: string | null;
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export default async function DividaDetailPage({
  params,
}: PageProps<"/dividas/[id]">) {
  const supabase = await createClient();

  const { id } = await params;

  const [, dividaRes, { data: pagamentosData }] = await Promise.all([
    requireSession(),
    supabase
      .from("dividas")
      .select("id, descricao, valor_total")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("pagamentos_divida")
      .select("id, valor, data_pagamento, observacao")
      .eq("divida_id", id)
      .order("data_pagamento", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  const divida = dividaRes.data;
  if (!divida) notFound();

  const pagamentos = (pagamentosData ?? []) as PagamentoRow[];
  const total = Number(divida.valor_total);
  const pago = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  const restante = Math.max(0, total - pago);
  const quitada = pago >= total;
  const progresso = total > 0 ? Math.min(100, (pago / total) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/dividas">
              <ArrowLeftIcon className="size-4" strokeWidth={2.75} />
              Voltar
            </Link>
          }
        />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-3xl leading-tight md:text-4xl">
              {divida.descricao}
            </h2>
            {quitada && (
              <Badge variant="secondary">
                <CheckCircle2Icon className="size-3" strokeWidth={2.75} />
                quitada
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Total {formatBRL(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EditDividaTrigger divida={divida} />
          <DividaActionsMenu id={divida.id} descricao={divida.descricao} />
        </div>
      </header>

      <Card className={quitada ? "" : "border-primary/40 bg-primary/5"}>
        <div className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Total
              </p>
              <p className="font-heading text-lg tabular-nums md:text-xl">
                {formatBRL(total)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Pago
              </p>
              <p className="font-heading text-lg tabular-nums text-sage-700 md:text-xl">
                {formatBRL(pago)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Falta
              </p>
              <p
                className={`font-heading text-lg tabular-nums md:text-xl ${
                  quitada ? "text-sage-700" : "text-primary"
                }`}
              >
                {formatBRL(restante)}
              </p>
            </div>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className={quitada ? "bg-sage-500" : "bg-primary"}
              style={{ width: `${progresso}%` }}
            />
          </div>
          {!quitada && (
            <div className="pt-2">
              <PagamentoFormDialog dividaId={divida.id} restante={restante} />
            </div>
          )}
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="font-heading text-lg">Pagamentos</h3>
          <p className="text-xs text-muted-foreground">
            {pagamentos.length}{" "}
            {pagamentos.length === 1 ? "registrado" : "registrados"}
          </p>
        </div>
        {pagamentos.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento registrado ainda.
              </p>
              <PagamentoFormDialog dividaId={divida.id} restante={restante} />
            </div>
          </Card>
        ) : (
          <Card>
            <ul className="flex flex-col divide-y divide-border/60">
              {pagamentos.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatDataBR(p.data_pagamento)}
                    </p>
                    {p.observacao && (
                      <p className="text-xs text-muted-foreground">
                        {p.observacao}
                      </p>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-sage-700">
                    −{formatBRL(p.valor)}
                  </span>
                  <PagamentoActionsMenu
                    id={p.id}
                    dividaId={divida.id}
                    valor={formatBRL(p.valor)}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
