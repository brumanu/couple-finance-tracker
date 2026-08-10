import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import {
  RecorrenteFormDialog,
  EditRecorrenteTrigger,
  type RecorrenteRow,
} from "./recorrente-form-dialog";
import { RecorrenteActionsMenu } from "./recorrente-actions-menu";

// Cartão / crédito = accent; demais = sage; pausadas caem para neutral
function categoriaVariant(
  categoria: string | null,
): "default" | "secondary" | "neutral" {
  if (!categoria) return "secondary";
  const c = categoria.toLowerCase();
  if (c.includes("cart") || c.includes("crédit") || c.includes("credit"))
    return "default";
  return "secondary";
}

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
  const contas15 = lista.filter((r) => r.quinzena === 15);
  const contas30 = lista.filter((r) => r.quinzena === 30);
  const total15 = contas15
    .filter((r) => r.ativa)
    .reduce((s, r) => s + Number(r.valor_previsto), 0);
  const total30 = contas30
    .filter((r) => r.ativa)
    .reduce((s, r) => s + Number(r.valor_previsto), 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Contas fixas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            As que voltam todo mês. Cada uma mora numa quinzena.
          </p>
        </div>
        <RecorrenteFormDialog />
      </header>

      {lista.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma conta cadastrada ainda.
            </p>
            <RecorrenteFormDialog />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ColunaContas
            titulo="Quinzena do dia 15"
            corDot="bg-sage-500"
            total={total15}
            itens={contas15}
          />
          <ColunaContas
            titulo="Quinzena do dia 30"
            corDot="bg-accent-500"
            total={total30}
            itens={contas30}
          />
        </div>
      )}
    </div>
  );
}

function ColunaContas({
  titulo,
  corDot,
  total,
  itens,
}: {
  titulo: string;
  corDot: string;
  total: number;
  itens: RecorrenteRow[];
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-block size-2 rounded-full ${corDot}`} />
            <p className="font-heading text-lg leading-none">{titulo}</p>
          </div>
          <p className="text-sm font-medium tabular-nums">
            {formatBRL(total)}
          </p>
        </div>
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma conta nesta quinzena.
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {r.descricao}
                    </p>
                    {r.categoria && (
                      <Badge
                        variant={categoriaVariant(r.categoria)}
                        className="text-[10px]"
                      >
                        {r.categoria}
                      </Badge>
                    )}
                    {!r.ativa && (
                      <Badge variant="neutral" className="text-[10px]">
                        pausada
                      </Badge>
                    )}
                  </div>
                  {r.dia_vencimento && (
                    <p className="text-xs text-muted-foreground">
                      Vence dia {r.dia_vencimento}
                    </p>
                  )}
                </div>
                <span className="whitespace-nowrap text-sm font-medium tabular-nums">
                  {formatBRL(r.valor_previsto)}
                </span>
                <EditRecorrenteTrigger recorrente={r} />
                <RecorrenteActionsMenu
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
