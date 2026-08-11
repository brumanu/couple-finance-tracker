import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import {
  BancoFormDialog,
  EditBancoTrigger,
  type BancoRow,
} from "./banco-form-dialog";
import { BancoActionsMenu } from "./banco-actions-menu";

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function BancosPage() {
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bancos")
    .select("id, nome, cor")
    .order("nome", { ascending: true });

  const lista = (data ?? []) as BancoRow[];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Bancos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Onde vivem seus cartões. Cadastre para começar a lançar compras.
          </p>
        </div>
        <BancoFormDialog />
      </header>

      {lista.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum banco cadastrado ainda.
            </p>
            <BancoFormDialog />
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((b) => (
            <Card key={b.id}>
              <div className="flex items-center gap-4 p-4">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-full font-heading text-lg text-white"
                  style={{ background: b.cor }}
                >
                  {iniciais(b.nome) || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-lg leading-tight">
                    {b.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">{b.cor}</p>
                </div>
                <EditBancoTrigger banco={b} />
                <BancoActionsMenu id={b.id} nome={b.nome} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
