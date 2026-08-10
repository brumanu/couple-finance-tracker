import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import {
  RendaFormDialog,
  EditRendaTrigger,
  type RendaRow,
} from "./renda-form-dialog";
import { RendaActionsMenu } from "./renda-actions-menu";

export default async function RendasPage() {
  await requireSession();
  const supabase = await createClient();

  const { data: rendas } = await supabase
    .from("rendas")
    .select("id, descricao, valor_previsto, dia_recebimento, ativa")
    .order("dia_recebimento", { ascending: true })
    .order("descricao", { ascending: true });

  const lista = (rendas ?? []) as RendaRow[];
  const total15 = lista
    .filter((r) => r.ativa && r.dia_recebimento === 15)
    .reduce((sum, r) => sum + Number(r.valor_previsto), 0);
  const total30 = lista
    .filter((r) => r.ativa && r.dia_recebimento === 30)
    .reduce((sum, r) => sum + Number(r.valor_previsto), 0);
  const totalMes = total15 + total30;

  const pct15 = totalMes > 0 ? (total15 / totalMes) * 100 : 0;
  const pct30 = totalMes > 0 ? (total30 / totalMes) * 100 : 0;

  const rendas15 = lista.filter((r) => r.dia_recebimento === 15);
  const rendas30 = lista.filter((r) => r.dia_recebimento === 30);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Rendas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O que entra por mês, dividido entre o adiantamento (dia 15) e o
            salário final (dia 30).
          </p>
        </div>
        <RendaFormDialog />
      </header>

      <Card>
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] uppercase tracking-widest text-primary">
              Entra por mês
            </p>
            <p
              className="font-heading tabular-nums"
              style={{ fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1 }}
            >
              {formatBRL(totalMes)}
            </p>
          </div>
          {totalMes > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-200">
                {pct15 > 0 && (
                  <div
                    className="bg-sage-500"
                    style={{ width: `${pct15}%` }}
                  />
                )}
                {pct30 > 0 && (
                  <div
                    className="bg-accent-500"
                    style={{ width: `${pct30}%` }}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-sage-500" />
                  <span className="text-foreground/80">
                    Dia 15{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatBRL(total15)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-accent-500" />
                  <span className="text-foreground/80">
                    Dia 30{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatBRL(total30)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {lista.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma renda cadastrada ainda.
            </p>
            <RendaFormDialog />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ColunaRendas
            titulo="Dia 15"
            subtitulo="Adiantamento"
            corDot="bg-sage-500"
            itens={rendas15}
          />
          <ColunaRendas
            titulo="Dia 30"
            subtitulo="Salário final"
            corDot="bg-accent-500"
            itens={rendas30}
          />
        </div>
      )}
    </div>
  );
}

function ColunaRendas({
  titulo,
  subtitulo,
  corDot,
  itens,
}: {
  titulo: string;
  subtitulo: string;
  corDot: string;
  itens: RendaRow[];
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <span className={`inline-block size-2 rounded-full ${corDot}`} />
          <div>
            <p className="font-heading text-lg leading-none">{titulo}</p>
            <p className="text-xs text-muted-foreground">{subtitulo}</p>
          </div>
        </div>
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma renda nesta quinzena.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {itens.map((r) => (
              <li
                key={r.id}
                className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 ${
                  r.ativa ? "" : "opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {r.descricao}
                    </p>
                    {!r.ativa && (
                      <Badge variant="neutral" className="text-[10px]">
                        pausada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Todo dia {r.dia_recebimento}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-medium tabular-nums">
                  {formatBRL(r.valor_previsto)}
                </span>
                <EditRendaTrigger renda={r} />
                <RendaActionsMenu
                  id={r.id}
                  ativa={r.ativa}
                  descricao={r.descricao}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

