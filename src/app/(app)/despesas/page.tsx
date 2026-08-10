import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseMesParam } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MonthSwitcher } from "../month-switcher";
import {
  DespesaFormDialog,
  EditDespesaTrigger,
  type DespesaRow,
} from "./despesa-form-dialog";
import { DespesaActionsMenu } from "./despesa-actions-menu";

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export default async function DespesasPage({
  searchParams,
}: PageProps<"/despesas">) {
  await requireSession();
  const supabase = await createClient();

  const params = await searchParams;
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const mes = parseMesParam(mesParam);

  const { data } = await supabase
    .from("lancamentos")
    .select("id, descricao, valor, data_pagamento, quinzena, categoria")
    .eq("tipo", "despesa_avulsa")
    .gte("data_referencia", mes.primeiroDia)
    .lte("data_referencia", mes.ultimoDia)
    .order("data_pagamento", { ascending: false });

  const lista = (data ?? []) as DespesaRow[];
  const total = lista.reduce((sum, d) => sum + Number(d.valor), 0);
  const total15 = lista
    .filter((d) => d.quinzena === 15)
    .reduce((sum, d) => sum + Number(d.valor), 0);
  const total30 = lista
    .filter((d) => d.quinzena === 30)
    .reduce((sum, d) => sum + Number(d.valor), 0);

  // Agrupa por data
  const grupos = new Map<string, DespesaRow[]>();
  for (const d of lista) {
    const key = d.data_pagamento;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(d);
  }
  const gruposList = Array.from(grupos.entries()); // já ordenado pela query

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Despesas</h2>
          <p className="text-sm text-muted-foreground">
            Gastos do dia a dia (mercado, gasolina, restaurante).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher mes={mes} />
          <DespesaFormDialog />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Quinzena 15
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBRL(total15)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Quinzena 30
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBRL(total30)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total do mês
            </p>
            <p className="text-2xl font-semibold tabular-nums text-primary">
              {formatBRL(total)}
            </p>
          </CardContent>
        </Card>
      </div>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma despesa lançada em {mes.label}.
            </p>
            <DespesaFormDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {gruposList.map(([data, itens]) => (
            <section key={data} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatDataBR(data)}
                </h3>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatBRL(
                    itens.reduce((sum, d) => sum + Number(d.valor), 0),
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {itens.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{d.descricao}</p>
                          {d.categoria && (
                            <Badge variant="secondary" className="text-xs">
                              {d.categoria}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            Q{d.quinzena}
                          </Badge>
                        </div>
                      </div>
                      <p className="whitespace-nowrap font-semibold tabular-nums text-red-700 dark:text-red-400">
                        −{formatBRL(d.valor)}
                      </p>
                      <EditDespesaTrigger despesa={d} />
                      <DespesaActionsMenu id={d.id} descricao={d.descricao} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
