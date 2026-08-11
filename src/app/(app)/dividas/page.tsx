import Link from "next/link";
import { ChevronRightIcon, CheckCircle2Icon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import {
  DividaFormDialog,
  EditDividaTrigger,
  type DividaRow,
} from "./divida-form-dialog";
import { DividaActionsMenu } from "./divida-actions-menu";

export default async function DividasPage() {
  await requireSession();
  const supabase = await createClient();

  const [dividasRes, pagRes] = await Promise.all([
    supabase
      .from("dividas")
      .select("id, descricao, valor_total")
      .order("created_at", { ascending: false }),
    supabase.from("pagamentos_divida").select("divida_id, valor"),
  ]);

  const dividas = (dividasRes.data ?? []) as DividaRow[];
  const pagamentos = (pagRes.data ?? []) as {
    divida_id: string;
    valor: number | string;
  }[];

  const pagoPorDivida = new Map<string, number>();
  for (const p of pagamentos) {
    pagoPorDivida.set(
      p.divida_id,
      (pagoPorDivida.get(p.divida_id) ?? 0) + Number(p.valor),
    );
  }

  const detalhes = dividas.map((d) => {
    const pago = pagoPorDivida.get(d.id) ?? 0;
    const total = Number(d.valor_total);
    const restante = Math.max(0, total - pago);
    const quitada = pago >= total;
    const progresso = total > 0 ? Math.min(100, (pago / total) * 100) : 0;
    return { divida: d, pago, total, restante, quitada, progresso };
  });

  const abertas = detalhes.filter((d) => !d.quitada);
  const quitadas = detalhes.filter((d) => d.quitada);
  const totalDevido = abertas.reduce((s, d) => s + d.restante, 0);
  const totalPagoAbertas = abertas.reduce((s, d) => s + d.pago, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Dívidas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre o que você deve e vai baixando conforme paga. Não entra
            no saldo da quinzena — é só pra não esquecer.
          </p>
        </div>
        <DividaFormDialog />
      </header>

      {dividas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nada em aberto por aqui.
            </p>
            <DividaFormDialog />
          </div>
        </Card>
      ) : (
        <>
          {abertas.length > 0 && (
            <Card className="border-primary/40 bg-primary/5">
              <div className="flex flex-col gap-3 p-6">
                <p className="text-[11px] uppercase tracking-widest text-primary">
                  Ainda em aberto
                </p>
                <div className="flex flex-wrap items-baseline gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Falta pagar</p>
                    <p
                      className="font-heading tabular-nums text-primary"
                      style={{
                        fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                        lineHeight: 1,
                      }}
                    >
                      {formatBRL(totalDevido)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Já pago</p>
                    <p className="font-medium tabular-nums text-sage-700">
                      {formatBRL(totalPagoAbertas)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {abertas.length === 1 ? "1 dívida" : `${abertas.length} dívidas`}
                    </p>
                    <p className="font-medium tabular-nums">em aberto</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {abertas.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="px-1 font-heading text-lg">Em aberto</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {abertas.map((d) => (
                  <DividaCard
                    key={d.divida.id}
                    detalhe={d}
                  />
                ))}
              </div>
            </section>
          )}

          {quitadas.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="px-1 font-heading text-lg text-muted-foreground">
                Quitadas
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {quitadas.map((d) => (
                  <DividaCard key={d.divida.id} detalhe={d} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DividaCard({
  detalhe,
}: {
  detalhe: {
    divida: DividaRow;
    pago: number;
    total: number;
    restante: number;
    quitada: boolean;
    progresso: number;
  };
}) {
  const { divida, pago, total, restante, quitada, progresso } = detalhe;
  return (
    <Card className={quitada ? "opacity-70" : ""}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-heading text-lg leading-tight">
                {divida.descricao}
              </p>
              {quitada && (
                <Badge variant="secondary" className="text-[10px]">
                  <CheckCircle2Icon className="size-3" strokeWidth={2.75} />
                  quitada
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total {formatBRL(total)} · Pago {formatBRL(pago)}
            </p>
          </div>
          <EditDividaTrigger divida={divida} />
          <DividaActionsMenu id={divida.id} descricao={divida.descricao} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className={quitada ? "bg-sage-500" : "bg-primary"}
              style={{ width: `${progresso}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted-foreground">
              {quitada ? "Zerada!" : "Ainda falta"}
            </p>
            <p
              className={`font-heading text-xl tabular-nums ${
                quitada ? "text-sage-700" : "text-primary"
              }`}
            >
              {formatBRL(restante)}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <Link href={`/dividas/${divida.id}`}>
              {quitada ? "Ver pagamentos" : "Registrar pagamento"}
              <ChevronRightIcon className="size-4" strokeWidth={2.75} />
            </Link>
          }
        />
      </div>
    </Card>
  );
}
