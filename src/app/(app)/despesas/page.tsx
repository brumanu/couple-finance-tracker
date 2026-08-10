import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseMesParam, mesAnterior } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MonthSwitcher } from "../month-switcher";
import {
  DespesaFormDialog,
  EditDespesaTrigger,
  type DespesaRow,
} from "./despesa-form-dialog";
import { DespesaActionsMenu } from "./despesa-actions-menu";

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

export default async function DespesasPage({
  searchParams,
}: PageProps<"/despesas">) {
  await requireSession();
  const supabase = await createClient();

  const params = await searchParams;
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const mes = parseMesParam(mesParam);
  const anterior = mesAnterior(mes);

  const [atualRes, anteriorRes] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("id, descricao, valor, data_pagamento, quinzena, categoria")
      .eq("tipo", "despesa_avulsa")
      .gte("data_referencia", mes.primeiroDia)
      .lte("data_referencia", mes.ultimoDia)
      .order("data_pagamento", { ascending: false }),
    supabase
      .from("lancamentos")
      .select("valor")
      .eq("tipo", "despesa_avulsa")
      .gte("data_referencia", anterior.primeiroDia)
      .lte("data_referencia", anterior.ultimoDia),
  ]);

  const lista = (atualRes.data ?? []) as DespesaRow[];
  const total = lista.reduce((sum, d) => sum + Number(d.valor), 0);
  const total15 = lista
    .filter((d) => d.quinzena === 15)
    .reduce((s, d) => s + Number(d.valor), 0);
  const total30 = lista
    .filter((d) => d.quinzena === 30)
    .reduce((s, d) => s + Number(d.valor), 0);

  const totalAnterior = (anteriorRes.data ?? []).reduce(
    (s, d) => s + Number(d.valor),
    0,
  );
  const deltaPct =
    totalAnterior > 0
      ? ((total - totalAnterior) / totalAnterior) * 100
      : total > 0
        ? 100
        : 0;

  const grupos = new Map<string, DespesaRow[]>();
  for (const d of lista) {
    const key = d.data_pagamento;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(d);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Despesas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mercado, gasolina, aquele jantar de sexta.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher mes={mes} />
          <div className="hidden md:block">
            <DespesaFormDialog />
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex flex-col gap-4 p-6">
            <p className="text-[11px] uppercase tracking-widest text-primary">
              Gasto em {mes.label}
            </p>
            <p
              className="font-heading tabular-nums"
              style={{ fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1 }}
            >
              {formatBRL(total)}
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="inline-block size-2 rounded-full bg-sage-500" />
                  Dia 15
                </span>
                <span className="tabular-nums">{formatBRL(total15)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="inline-block size-2 rounded-full bg-accent-500" />
                  Dia 30
                </span>
                <span className="tabular-nums">{formatBRL(total30)}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 p-6">
            <p className="text-[11px] uppercase tracking-widest text-primary">
              Comparado a {anterior.label}
            </p>
            <div className="flex items-baseline gap-3">
              <p
                className={`font-heading tabular-nums ${
                  deltaPct <= 0 ? "text-sage-700" : "text-primary"
                }`}
                style={{ fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1 }}
              >
                {deltaPct === 0 ? "—" : `${deltaPct > 0 ? "+" : "−"}${Math.abs(deltaPct).toFixed(0)}%`}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {totalAnterior > 0
                ? `Você gastou ${formatBRL(totalAnterior)} em ${anterior.label}.`
                : `Nenhum gasto em ${anterior.label} — sem base de comparação.`}
            </p>
          </div>
        </Card>
      </div>

      {lista.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma despesa lançada em {mes.label}.
            </p>
            <DespesaFormDialog />
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {Array.from(grupos.entries()).map(([data, itens]) => {
            const totalDia = itens.reduce(
              (s, d) => s + Number(d.valor),
              0,
            );
            return (
              <section key={data} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {formatDataLonga(data)}
                  </h3>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatBRL(totalDia)}
                  </p>
                </div>
                <Card>
                  <ul className="flex flex-col divide-y divide-border/60">
                    {itens.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 font-heading text-xs">
                          {d.descricao[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {d.descricao}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {d.categoria ? `${d.categoria} · ` : ""}
                            quinzena {d.quinzena}
                          </p>
                        </div>
                        {d.categoria && (
                          <Badge variant="secondary" className="hidden md:inline-flex text-[10px]">
                            {d.categoria}
                          </Badge>
                        )}
                        <span className="whitespace-nowrap text-sm font-medium tabular-nums text-primary">
                          −{formatBRL(d.valor)}
                        </span>
                        <EditDespesaTrigger despesa={d} />
                        <DespesaActionsMenu
                          id={d.id}
                          descricao={d.descricao}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
