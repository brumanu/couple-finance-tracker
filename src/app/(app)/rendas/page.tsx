import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias-server";
import { parseMesParam } from "@/lib/mes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { MonthSwitcher } from "../month-switcher";
import {
  RendaFormDialog,
  EditRendaTrigger,
  type RendaRow,
} from "./renda-form-dialog";
import { RendaActionsMenu } from "./renda-actions-menu";
import {
  RendaExtraFormDialog,
  EditRendaExtraTrigger,
  type RendaExtraRow,
} from "./renda-extra-form-dialog";
import { RendaExtraActionsMenu } from "./renda-extra-actions-menu";

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function formatDataLonga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DIAS_SEMANA[date.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export default async function RendasPage({
  searchParams,
}: PageProps<"/rendas">) {
  const supabase = await createClient();

  const params = await searchParams;
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const mes = parseMesParam(mesParam);

  const [, categorias, { data: rendas }, { data: rendasExtra }] =
    await Promise.all([
      requireSession(),
      getCategorias(),
      supabase
        .from("rendas")
        .select("id, descricao, valor_previsto, dia_recebimento, ativa")
        .order("dia_recebimento", { ascending: true })
        .order("descricao", { ascending: true }),
      supabase
        .from("lancamentos")
        .select(
          "id, descricao, valor, data_pagamento, data_referencia, quinzena, categoria, categoria_id",
        )
        .eq("tipo", "renda_extra")
        .gte("data_referencia", mes.primeiroDia)
        .lte("data_referencia", mes.ultimoDia)
        .order("data_pagamento", { ascending: false }),
    ]);

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

  const listaExtra = (rendasExtra ?? []) as RendaExtraRow[];
  const totalExtra = listaExtra.reduce((s, r) => s + Number(r.valor), 0);

  const gruposExtra = new Map<string, RendaExtraRow[]>();
  for (const r of listaExtra) {
    const key = r.data_pagamento ?? r.data_referencia ?? "sem-data";
    if (!gruposExtra.has(key)) gruposExtra.set(key, []);
    gruposExtra.get(key)!.push(r);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
            Rendas
          </h2>
          <p className="mt-1.5 max-w-[60ch] text-[15px] text-neutral-700">
            O que entra todo mês: adiantamento no dia 15, salário no dia 30.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher mes={mes} />
          <RendaFormDialog
            trigger={
              <Button variant="outline" size="sm">
                Renda fixa
              </Button>
            }
          />
          <RendaExtraFormDialog categorias={categorias} />
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-wrap items-center gap-8 rounded-[28px] bg-card p-7 md:gap-11 md:p-8">
          <div className="min-w-[220px]">
            <p className="text-[11px] uppercase tracking-widest text-accent-700">
              Entra todo mês (fixo)
            </p>
            <p
              className="mt-2 font-heading tabular-nums"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3rem)", lineHeight: 1 }}
            >
              {formatBRL(totalMes)}
            </p>
          </div>
          {totalMes > 0 && (
            <div className="flex flex-1 flex-col gap-2.5">
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-neutral-200">
                {pct15 > 0 && (
                  <div className="bg-sage-500" style={{ width: `${pct15}%` }} />
                )}
                {pct30 > 0 && (
                  <div
                    className="bg-accent-400"
                    style={{ width: `${pct30}%` }}
                  />
                )}
              </div>
              <div className="flex flex-wrap justify-between gap-4 text-[13px] text-neutral-800">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full bg-sage-500" />
                  Dia 15 —{" "}
                  <span className="font-medium tabular-nums">
                    {formatBRL(total15)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full bg-accent-400" />
                  Dia 30 —{" "}
                  <span className="font-medium tabular-nums">
                    {formatBRL(total30)}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-[28px] bg-surface-soft px-8 py-7">
          <p className="text-[11px] uppercase tracking-widest text-neutral-700">
            Extra em {mes.label}
          </p>
          <p
            className="font-heading tabular-nums"
            style={{ fontSize: "clamp(2.25rem, 5vw, 2.75rem)", lineHeight: 1 }}
          >
            {formatBRL(totalExtra)}
          </p>
          {listaExtra.length > 0 ? (
            <p className="text-[14px] text-neutral-700">
              {listaExtra.length}{" "}
              {listaExtra.length === 1 ? "lançamento" : "lançamentos"} neste
              mês
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-[14px] text-neutral-700">
                Nenhuma renda extra neste mês.
              </p>
              <RendaExtraFormDialog categorias={categorias} />
            </div>
          )}
        </div>
      </div>

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
        <div className="grid gap-6 md:grid-cols-2">
          <ColunaRendas titulo="Dia 15 · adiantamento" itens={rendas15} />
          <ColunaRendas titulo="Dia 30 · salário" itens={rendas30} />
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="px-1 font-heading text-[20px]">
          Renda extra em {mes.label}
        </h3>
        {listaExtra.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[26px] bg-card px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma renda extra lançada em {mes.label}.
            </p>
            <RendaExtraFormDialog categorias={categorias} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Array.from(gruposExtra.entries()).map(([data, itens]) => {
              const totalDia = itens.reduce((s, r) => s + Number(r.valor), 0);
              return (
                <div key={data} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between px-1.5">
                    <h4 className="font-heading text-[17px]">
                      {/^\d{4}-\d{2}-\d{2}$/.test(data)
                        ? formatDataLonga(data)
                        : "Sem data"}
                    </h4>
                    <p className="tabular-nums text-[14px] text-neutral-700">
                      {formatBRL(totalDia)}
                    </p>
                  </div>
                  <div className="rounded-[26px] bg-card px-6">
                    <ul className="flex flex-col divide-y divide-border/60">
                      {itens.map((r) => (
                        <li key={r.id} className="flex items-center gap-4 py-4">
                          <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-sage-100 font-heading text-sm text-sage-800">
                            {r.descricao[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold">
                              {r.descricao}
                            </p>
                            <p className="text-[13px] text-neutral-700">
                              {r.categoria ? `${r.categoria} · ` : ""}
                              quinzena {r.quinzena}
                            </p>
                          </div>
                          <span className="whitespace-nowrap font-heading text-[17px] tabular-nums text-sage-700">
                            {formatBRL(r.valor)}
                          </span>
                          <EditRendaExtraTrigger
                            rendaExtra={r}
                            categorias={categorias}
                          />
                          <RendaExtraActionsMenu
                            id={r.id}
                            descricao={r.descricao}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ColunaRendas({
  titulo,
  itens,
}: {
  titulo: string;
  itens: RendaRow[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="px-1 font-heading text-[20px]">{titulo}</h3>
      {itens.length === 0 ? (
        <div className="rounded-[26px] bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhuma renda nesta quinzena.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {itens.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-4 rounded-[26px] bg-card px-5 py-4 ${
                r.ativa ? "" : "opacity-60"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] leading-snug font-semibold">
                    {r.descricao}
                  </p>
                  {!r.ativa && (
                    <Badge variant="neutral" className="text-[10px]">
                      pausada
                    </Badge>
                  )}
                </div>
                <p className="text-[13px] text-neutral-700">
                  Todo dia {r.dia_recebimento}
                </p>
              </div>
              <span className="whitespace-nowrap font-heading text-[17px] tabular-nums">
                {formatBRL(r.valor_previsto)}
              </span>
              <EditRendaTrigger renda={r} />
              <RendaActionsMenu
                id={r.id}
                ativa={r.ativa}
                descricao={r.descricao}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
