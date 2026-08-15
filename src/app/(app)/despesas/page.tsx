import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCartoesParaSelecao } from "@/lib/cartoes-selection";
import { getCategorias } from "@/lib/categorias-server";
import { getMembrosCasal } from "@/lib/membros-server";
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

  const [cartoes, categorias, membros] = await Promise.all([
    getCartoesParaSelecao(),
    getCategorias(),
    getMembrosCasal(),
  ]);

  const [atualRes, anteriorRes] = await Promise.all([
    supabase
      .from("lancamentos")
      .select(
        "id, descricao, valor, data_pagamento, data_referencia, quinzena, categoria, categoria_id, quem_gastou",
      )
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
    totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : null;

  const grupos = new Map<string, DespesaRow[]>();
  for (const d of lista) {
    const key = d.data_pagamento ?? d.data_referencia ?? "sem-data";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(d);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
            Despesas
          </h2>
          <p className="mt-1.5 text-[15px] text-neutral-700">
            Mercado, gasolina, farmácia — o gasto solto do mês.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher mes={mes} />
          <div className="hidden md:block">
            <DespesaFormDialog
              cartoes={cartoes}
              categorias={categorias}
              membros={membros}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-[28px] bg-card px-8 py-7">
          <p className="text-[11px] uppercase tracking-widest text-accent-700">
            Gasto em {mes.label}
          </p>
          <p
            className="font-heading tabular-nums"
            style={{ fontSize: "clamp(2.25rem, 5vw, 2.75rem)", lineHeight: 1 }}
          >
            {formatBRL(total)}
          </p>
          <p className="text-[14px] text-neutral-700">
            {formatBRL(total15)} na quinzena 15 · {formatBRL(total30)} na 30
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-[28px] bg-surface-soft px-8 py-7">
          <p className="text-[11px] uppercase tracking-widest text-neutral-700">
            Comparado a {anterior.label}
          </p>
          <div className="flex items-baseline gap-3">
            <p
              className={`font-heading tabular-nums ${
                deltaPct === null || deltaPct <= 0
                  ? "text-sage-700"
                  : "text-primary"
              }`}
              style={{ fontSize: "clamp(2rem, 5vw, 2.375rem)", lineHeight: 1 }}
            >
              {deltaPct === null
                ? total > 0
                  ? "novo"
                  : "—"
                : deltaPct === 0
                  ? "—"
                  : `${deltaPct > 0 ? "+" : "−"}${Math.abs(deltaPct).toFixed(0)}%`}
            </p>
            <span className="text-[14px] text-neutral-700">
              {anterior.label} fechou em {formatBRL(totalAnterior)}
            </span>
          </div>
        </div>
      </div>

      {lista.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma despesa lançada em {mes.label}.
            </p>
            <DespesaFormDialog
              cartoes={cartoes}
              categorias={categorias}
              membros={membros}
            />
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(grupos.entries()).map(([data, itens]) => {
            const totalDia = itens.reduce((s, d) => s + Number(d.valor), 0);
            return (
              <section key={data} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between px-1.5">
                  <h3 className="font-heading text-[19px]">
                    {/^\d{4}-\d{2}-\d{2}$/.test(data) ? formatDataLonga(data) : "Sem data"}
                  </h3>
                  <p className="tabular-nums text-[14px] text-neutral-700">
                    {formatBRL(totalDia)}
                  </p>
                </div>
                <div className="rounded-[26px] bg-card px-6">
                  <ul className="flex flex-col divide-y divide-border/60">
                    {itens.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center gap-4 py-4"
                      >
                        <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-background font-heading text-sm text-neutral-800">
                          {d.descricao[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">
                            {d.descricao}
                          </p>
                          <p className="text-[13px] text-neutral-700">
                            {d.categoria ? `${d.categoria} · ` : ""}
                            quinzena {d.quinzena}
                          </p>
                        </div>
                        <span className="whitespace-nowrap font-heading text-[17px] tabular-nums">
                          {formatBRL(d.valor)}
                        </span>
                        <EditDespesaTrigger
                          despesa={d}
                          categorias={categorias}
                          membros={membros}
                        />
                        <DespesaActionsMenu
                          id={d.id}
                          descricao={d.descricao}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
