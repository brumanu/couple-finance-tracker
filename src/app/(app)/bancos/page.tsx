import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { BancoIcone } from "@/lib/bancos-icones";
import type { BancoRow } from "./banco-form-dialog";
import { BancoDialogs, EditarBanco, NovoBanco } from "./banco-dialogs";
import { BancoActionsMenu } from "./banco-actions-menu";

export const metadata: Metadata = { title: "Bancos" };

export default async function BancosPage() {
  const supabase = await createClient();

  const [, bancosRes, cartoesRes] = await Promise.all([
    requireSession(),
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
    <BancoDialogs>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
              Bancos
            </h2>
            <p className="mt-1.5 max-w-[46ch] text-[15px] text-neutral-700">
              Onde vivem os cartões. O ícone identifica cada um de bate-pronto.
            </p>
          </div>
          <NovoBanco />
        </header>

        {lista.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum banco cadastrado ainda.
              </p>
              <NovoBanco />
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
                <div
                  key={b.id}
                  className="flex items-center gap-4 rounded-[24px] bg-card px-5 py-4"
                >
                  <BancoIcone
                    icone={b.icone}
                    corFallback={b.cor}
                    nomeFallback={b.nome}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{b.nome}</p>
                    <p className="mt-0.5 text-[13px] text-neutral-700">
                      {subtitulo}
                    </p>
                  </div>
                  <EditarBanco linha={b} />
                  <BancoActionsMenu id={b.id} nome={b.nome} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BancoDialogs>
  );
}
