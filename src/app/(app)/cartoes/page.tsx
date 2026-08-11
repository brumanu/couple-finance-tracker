import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseMesParam } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import {
  faturaDoMes,
  type CompraCartaoInfo,
  type AssinaturaCartaoInfo,
} from "@/lib/cartao-calc";
import { BancoIcone } from "@/lib/bancos-icones";
import {
  CartaoFormDialog,
  EditCartaoTrigger,
  type CartaoRow,
  type BancoOption,
} from "./cartao-form-dialog";
import { CartaoActionsMenu } from "./cartao-actions-menu";

const BANDEIRA_LABEL: Record<string, string> = {
  visa: "Visa",
  master: "Mastercard",
  elo: "Elo",
  amex: "Amex",
  hipercard: "Hipercard",
  outra: "Outra",
};

export default async function CartoesPage({
  searchParams,
}: PageProps<"/cartoes">) {
  await requireSession();
  const supabase = await createClient();

  const params = await searchParams;
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const mes = parseMesParam(mesParam);

  const [bancosRes, cartoesRes, comprasRes, assinRes] = await Promise.all([
    supabase
      .from("bancos")
      .select("id, nome, cor, icone")
      .order("nome", { ascending: true }),
    supabase
      .from("cartoes")
      .select(
        "id, banco_id, apelido, bandeira, dia_fechamento, dia_vencimento, ativo",
      )
      .order("apelido", { ascending: true }),
    supabase
      .from("compras_cartao")
      .select(
        "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria",
      ),
    supabase
      .from("assinaturas_cartao")
      .select(
        "id, cartao_id, descricao, valor_mensal, categoria, inicio_vigencia, fim_vigencia, ativa",
      ),
  ]);

  const bancos = (bancosRes.data ?? []) as BancoOption[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
  const compras = (comprasRes.data ?? []) as CompraCartaoInfo[];
  const assinaturas = (assinRes.data ?? []) as AssinaturaCartaoInfo[];

  const bancoById = new Map(bancos.map((b) => [b.id, b]));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Cartões
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Faturas de {mes.label}. Clique num cartão para ver as compras.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/bancos">Bancos</Link>}
          />
          <CartaoFormDialog bancos={bancos} />
        </div>
      </header>

      {cartoes.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            {bancos.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Nenhum banco cadastrado ainda. Cadastre um banco antes de
                  criar um cartão.
                </p>
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/bancos">Cadastrar banco</Link>}
                />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Nenhum cartão cadastrado ainda.
                </p>
                <CartaoFormDialog bancos={bancos} />
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cartoes.map((c) => {
            const banco = bancoById.get(c.banco_id);
            const label = banco?.nome
              ? c.apelido
                ? `${banco.nome} · ${c.apelido}`
                : banco.nome
              : c.apelido ?? "Cartão";
            const fatura = faturaDoMes(
              { id: c.id, dia_fechamento: c.dia_fechamento, dia_vencimento: c.dia_vencimento },
              compras,
              mes,
              assinaturas,
            );
            return (
              <Card key={c.id} className={c.ativo ? "" : "opacity-60"}>
                <div className="flex flex-col gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <BancoIcone
                      icone={banco?.icone ?? null}
                      corFallback={banco?.cor}
                      nomeFallback={banco?.nome ?? label}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-lg leading-tight">
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.bandeira ? BANDEIRA_LABEL[c.bandeira] : ""}
                        {c.bandeira ? " · " : ""}
                        Fecha dia {c.dia_fechamento} · Vence dia {c.dia_vencimento}
                      </p>
                    </div>
                    {!c.ativo && (
                      <Badge variant="neutral" className="text-[10px]">
                        pausado
                      </Badge>
                    )}
                    <EditCartaoTrigger cartao={c} bancos={bancos} />
                    <CartaoActionsMenu
                      id={c.id}
                      ativo={c.ativo}
                      label={label}
                    />
                  </div>

                  <div className="flex items-end justify-between border-t border-border/60 pt-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Fatura de {mes.label}
                      </p>
                      <p className="mt-1 font-heading text-2xl tabular-nums">
                        {formatBRL(fatura.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fatura.parcelas.length === 0
                          ? "Sem compras"
                          : `${fatura.parcelas.length} ${fatura.parcelas.length === 1 ? "compra" : "compras"}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link href={`/cartoes/${c.id}?mes=${mes.chave}`}>
                          Detalhes
                          <ChevronRightIcon
                            className="size-4"
                            strokeWidth={2.75}
                          />
                        </Link>
                      }
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
