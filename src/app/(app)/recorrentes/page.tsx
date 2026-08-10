import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import {
  RecorrenteFormDialog,
  EditRecorrenteTrigger,
  type RecorrenteRow,
} from "./recorrente-form-dialog";
import { RecorrenteActionsMenu } from "./recorrente-actions-menu";

export default async function RecorrentesPage() {
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("contas_recorrentes")
    .select(
      "id, descricao, valor_previsto, quinzena, dia_vencimento, categoria, ativa",
    )
    .order("quinzena", { ascending: true })
    .order("dia_vencimento", { ascending: true, nullsFirst: false })
    .order("descricao", { ascending: true });

  const lista = (data ?? []) as RecorrenteRow[];
  const grupos: { quinzena: 15 | 30; itens: RecorrenteRow[] }[] = [
    { quinzena: 15, itens: lista.filter((r) => r.quinzena === 15) },
    { quinzena: 30, itens: lista.filter((r) => r.quinzena === 30) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Contas recorrentes
          </h2>
          <p className="text-sm text-muted-foreground">
            Contas fixas que se repetem todo mês. Atribua manualmente a cada
            quinzena.
          </p>
        </div>
        <RecorrenteFormDialog />
      </div>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma conta cadastrada ainda.
            </p>
            <RecorrenteFormDialog />
          </CardContent>
        </Card>
      ) : (
        grupos.map(({ quinzena, itens }) => {
          const totalAtivo = itens
            .filter((r) => r.ativa)
            .reduce((sum, r) => sum + Number(r.valor_previsto), 0);
          return (
            <section key={quinzena} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between px-1">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Quinzena do dia {quinzena}
                </h3>
                <p className="text-sm tabular-nums">
                  <span className="text-muted-foreground">Total ativo:</span>{" "}
                  <span className="font-semibold">
                    {formatBRL(totalAtivo)}
                  </span>
                </p>
              </div>
              {itens.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    Nenhuma conta nesta quinzena.
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {itens.map((r) => (
                    <Card key={r.id} className={r.ativa ? "" : "opacity-60"}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">
                              {r.descricao}
                            </p>
                            {r.categoria && (
                              <Badge variant="secondary" className="text-xs">
                                {r.categoria}
                              </Badge>
                            )}
                            {!r.ativa && (
                              <Badge variant="outline" className="text-xs">
                                inativa
                              </Badge>
                            )}
                          </div>
                          {r.dia_vencimento && (
                            <p className="text-xs text-muted-foreground">
                              Vence dia {r.dia_vencimento}
                            </p>
                          )}
                        </div>
                        <p className="whitespace-nowrap font-semibold tabular-nums">
                          {formatBRL(r.valor_previsto)}
                        </p>
                        <EditRecorrenteTrigger recorrente={r} />
                        <RecorrenteActionsMenu
                          id={r.id}
                          ativa={r.ativa}
                          descricao={r.descricao}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
