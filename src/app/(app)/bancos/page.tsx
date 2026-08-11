import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { BancoIcone } from "@/lib/bancos-icones";
import {
  BancoFormDialog,
  EditBancoTrigger,
  type BancoRow,
} from "./banco-form-dialog";
import { BancoActionsMenu } from "./banco-actions-menu";

export default async function BancosPage() {
  await requireSession();
  const supabase = await createClient();

  const [bancosRes, cartoesRes] = await Promise.all([
    supabase
      .from("bancos")
      .select("id, nome, cor, icone")
      .order("nome", { ascending: true }),
    supabase.from("cartoes").select("banco_id"),
  ]);

  const lista = (bancosRes.data ?? []) as BancoRow[];
  const cartoes = (cartoesRes.data ?? []) as { banco_id: string }[];

  const contagem = new Map<string, number>();
  for (const c of cartoes) {
    contagem.set(c.banco_id, (contagem.get(c.banco_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Bancos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Onde vivem os cartões. O ícone identifica cada um de bate-pronto.
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
          {lista.map((b) => {
            const n = contagem.get(b.id) ?? 0;
            const subtitulo =
              n === 0
                ? "Sem cartões"
                : n === 1
                  ? "1 cartão"
                  : `${n} cartões`;
            return (
              <Card key={b.id}>
                <div className="flex items-center gap-4 p-4">
                  <BancoIcone
                    icone={b.icone}
                    corFallback={b.cor}
                    nomeFallback={b.nome}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-lg leading-tight">
                      {b.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {subtitulo}
                    </p>
                  </div>
                  <EditBancoTrigger banco={b} />
                  <BancoActionsMenu id={b.id} nome={b.nome} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
