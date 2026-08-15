import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias-server";
import { getMembrosCasal } from "@/lib/membros-server";
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
  const supabase = await createClient();

  const [, { data }, categorias, membros] = await Promise.all([
    requireSession(),
    supabase
      .from("contas_recorrentes")
      .select(
        "id, descricao, valor_previsto, quinzena, dia_vencimento, categoria, categoria_id, quem_gastou, ativa",
      )
      .order("quinzena", { ascending: true })
      .order("dia_vencimento", { ascending: true, nullsFirst: false })
      .order("descricao", { ascending: true }),
    getCategorias(),
    getMembrosCasal(),
  ]);

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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
            Contas fixas
          </h2>
          <p className="mt-1.5 max-w-[60ch] text-[15px] text-neutral-700">
            As que voltam todo mês. Cada uma mora numa quinzena.
          </p>
        </div>
        <RecorrenteFormDialog categorias={categorias} membros={membros} />
      </header>

      {lista.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma conta cadastrada ainda.
            </p>
            <RecorrenteFormDialog categorias={categorias} membros={membros} />
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-2">
          <ColunaContas
            titulo="Quinzena do dia 15"
            total={total15}
            itens={contas15}
            categorias={categorias}
            membros={membros}
          />
          <ColunaContas
            titulo="Quinzena do dia 30"
            total={total30}
            itens={contas30}
            categorias={categorias}
            membros={membros}
          />
        </div>
      )}
    </div>
  );
}

function ColunaContas({
  titulo,
  total,
  itens,
  categorias,
  membros,
}: {
  titulo: string;
  total: number;
  itens: RecorrenteRow[];
  categorias: Awaited<ReturnType<typeof getCategorias>>;
  membros: Awaited<ReturnType<typeof getMembrosCasal>>;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="font-heading text-[20px]">{titulo}</h3>
        <span className="tabular-nums text-[14px] text-neutral-700">
          {formatBRL(total)}
        </span>
      </div>
      {itens.length === 0 ? (
        <div className="rounded-[26px] bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhuma conta nesta quinzena.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {itens.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3.5 rounded-[26px] px-5 py-4 ${
                r.ativa ? "bg-card" : "bg-surface-soft opacity-70"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate text-[15px] font-semibold">
                    {r.descricao}
                  </p>
                  {r.categoria && (
                    <Badge
                      variant={categoriaVariant(r.categoria)}
                      className="shrink-0 text-[11px]"
                    >
                      {r.categoria}
                    </Badge>
                  )}
                  {!r.ativa && (
                    <Badge variant="neutral" className="shrink-0 text-[10px]">
                      pausada
                    </Badge>
                  )}
                </div>
                {r.dia_vencimento && (
                  <p className="mt-0.5 text-[13px] text-neutral-700">
                    Vence dia {r.dia_vencimento}
                  </p>
                )}
              </div>
              <span className="whitespace-nowrap font-heading text-[17px] tabular-nums">
                {formatBRL(r.valor_previsto)}
              </span>
              <EditRecorrenteTrigger
                recorrente={r}
                categorias={categorias}
                membros={membros}
              />
              <RecorrenteActionsMenu
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
