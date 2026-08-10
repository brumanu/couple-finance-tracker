import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const totalAtivo15 = lista
    .filter((r) => r.ativa && r.dia_recebimento === 15)
    .reduce((sum, r) => sum + Number(r.valor_previsto), 0);
  const totalAtivo30 = lista
    .filter((r) => r.ativa && r.dia_recebimento === 30)
    .reduce((sum, r) => sum + Number(r.valor_previsto), 0);
  const totalGeral = totalAtivo15 + totalAtivo30;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Rendas</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre as rendas fixas que entram no dia 15 (adiantamento) e no
            dia 30 (salário final).
          </p>
        </div>
        <RendaFormDialog />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Quinzena 15
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBRL(totalAtivo15)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Quinzena 30
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBRL(totalAtivo30)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total mensal
            </p>
            <p className="text-2xl font-semibold tabular-nums text-primary">
              {formatBRL(totalGeral)}
            </p>
          </CardContent>
        </Card>
      </div>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma renda cadastrada ainda.
            </p>
            <RendaFormDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((renda) => (
            <Card key={renda.id} className={renda.ativa ? "" : "opacity-60"}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{renda.descricao}</p>
                    {!renda.ativa && (
                      <Badge variant="outline" className="text-xs">
                        inativa
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dia {renda.dia_recebimento} ·{" "}
                    {renda.dia_recebimento === 15
                      ? "adiantamento"
                      : "salário final"}
                  </p>
                </div>
                <p className="whitespace-nowrap font-semibold tabular-nums">
                  {formatBRL(renda.valor_previsto)}
                </p>
                <EditRendaTrigger renda={renda} />
                <RendaActionsMenu
                  id={renda.id}
                  ativa={renda.ativa}
                  descricao={renda.descricao}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
