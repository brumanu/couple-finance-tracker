import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import {
  CategoriaFormDialog,
  EditCategoriaTrigger,
  type CategoriaRow,
} from "./categoria-form-dialog";
import { CategoriaActionsMenu } from "./categoria-actions-menu";

export default async function CategoriasPage() {
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("categorias")
    .select("id, nome, cor, emoji")
    .order("nome", { ascending: true });

  const lista = (data ?? []) as CategoriaRow[];

  // Contagem de uso — pra dar contexto na hora de excluir
  const [
    { data: contasRec },
    { data: lancs },
    { data: compras },
    { data: assins },
  ] = await Promise.all([
    supabase.from("contas_recorrentes").select("categoria_id"),
    supabase.from("lancamentos").select("categoria_id"),
    supabase.from("compras_cartao").select("categoria_id"),
    supabase.from("assinaturas_cartao").select("categoria_id"),
  ]);

  const uso = new Map<string, number>();
  const somaUso = (rows: { categoria_id: string | null }[] | null) => {
    for (const r of rows ?? []) {
      if (!r.categoria_id) continue;
      uso.set(r.categoria_id, (uso.get(r.categoria_id) ?? 0) + 1);
    }
  };
  somaUso(contasRec);
  somaUso(lancs);
  somaUso(compras);
  somaUso(assins);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Categorias
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Etiquetas reutilizáveis pra classificar despesas, contas e compras
            no cartão.
          </p>
        </div>
        <CategoriaFormDialog />
      </header>

      {lista.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma categoria cadastrada ainda.
            </p>
            <CategoriaFormDialog />
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="flex flex-col divide-y divide-border/60">
            {lista.map((c) => {
              const count = uso.get(c.id) ?? 0;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                    style={{ backgroundColor: c.cor, color: "#fff" }}
                    aria-hidden
                  >
                    {c.emoji ?? c.nome[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {count === 0
                        ? "sem uso"
                        : `usada em ${count} ${count === 1 ? "lançamento" : "lançamentos"}`}
                    </p>
                  </div>
                  <EditCategoriaTrigger categoria={c} />
                  <CategoriaActionsMenu id={c.id} nome={c.nome} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
