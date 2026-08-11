import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseMesParam } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import {
  faturaDoMes,
  mesPrimeiraParcela,
  parcelaNoMes,
  valoresParcelas,
  type CompraCartaoInfo,
} from "@/lib/cartao-calc";
import { BancoIcone } from "@/lib/bancos-icones";
import { MonthSwitcher } from "../../month-switcher";
import {
  CompraFormDialog,
  EditCompraTrigger,
  type CompraRow,
} from "./compra-form-dialog";
import { CompraActionsMenu } from "./compra-actions-menu";

const BANDEIRA_LABEL: Record<string, string> = {
  visa: "Visa",
  master: "Mastercard",
  elo: "Elo",
  amex: "Amex",
  hipercard: "Hipercard",
  outra: "Outra",
};

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export default async function CartaoDetailPage({
  params,
  searchParams,
}: PageProps<"/cartoes/[id]">) {
  await requireSession();
  const supabase = await createClient();

  const { id } = await params;
  const sp = await searchParams;
  const mesParam = typeof sp.mes === "string" ? sp.mes : undefined;
  const mes = parseMesParam(mesParam);

  const cartaoRes = await supabase
    .from("cartoes")
    .select(
      "id, banco_id, apelido, bandeira, dia_fechamento, dia_vencimento, ativo",
    )
    .eq("id", id)
    .maybeSingle();
  const cartao = cartaoRes.data;
  if (!cartao) notFound();

  const [bancoRes, comprasRes] = await Promise.all([
    supabase
      .from("bancos")
      .select("id, nome, cor, icone")
      .eq("id", cartao.banco_id)
      .maybeSingle(),
    supabase
      .from("compras_cartao")
      .select(
        "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria",
      )
      .eq("cartao_id", id)
      .order("data_compra", { ascending: false }),
  ]);

  const banco = bancoRes.data;
  const compras = (comprasRes.data ?? []) as CompraRow[];

  const label = banco?.nome
    ? cartao.apelido
      ? `${banco.nome} · ${cartao.apelido}`
      : banco.nome
    : cartao.apelido ?? "Cartão";

  const fatura = faturaDoMes(
    {
      id: cartao.id,
      dia_fechamento: cartao.dia_fechamento,
      dia_vencimento: cartao.dia_vencimento,
    },
    compras as CompraCartaoInfo[],
    mes,
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/cartoes">
              <ArrowLeftIcon className="size-4" strokeWidth={2.75} />
              Voltar
            </Link>
          }
        />
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BancoIcone
            icone={banco?.icone ?? null}
            corFallback={banco?.cor}
            nomeFallback={banco?.nome ?? label}
            size={56}
          />
          <div>
            <h2 className="font-heading text-3xl leading-tight md:text-4xl">
              {label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {cartao.bandeira ? BANDEIRA_LABEL[cartao.bandeira] : ""}
              {cartao.bandeira ? " · " : ""}
              Fecha dia {cartao.dia_fechamento} · Vence dia {cartao.dia_vencimento}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MonthSwitcher mes={mes} />
          <CompraFormDialog
            cartaoId={cartao.id}
            diaFechamento={cartao.dia_fechamento}
          />
        </div>
      </header>

      <Card>
        <div className="flex flex-col gap-3 p-6">
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Fatura de {mes.label}
          </p>
          <p
            className="font-heading tabular-nums"
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1 }}
          >
            {formatBRL(fatura.total)}
          </p>
          <p className="text-sm text-muted-foreground">
            {fatura.parcelas.length === 0
              ? "Nenhuma compra cai nesta fatura."
              : `${fatura.parcelas.length} ${fatura.parcelas.length === 1 ? "compra" : "compras"} nesta fatura · vence dia ${cartao.dia_vencimento}`}
          </p>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="font-heading text-lg">Compras</h3>
          <p className="text-xs text-muted-foreground">
            {compras.length}{" "}
            {compras.length === 1 ? "registrada" : "registradas"}
          </p>
        </div>
        {compras.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma compra registrada neste cartão ainda.
              </p>
              <CompraFormDialog
                cartaoId={cartao.id}
                diaFechamento={cartao.dia_fechamento}
              />
            </div>
          </Card>
        ) : (
          <Card>
            <ul className="flex flex-col divide-y divide-border/60">
              {compras.map((c) => {
                const info = parcelaNoMes(
                  c as CompraCartaoInfo,
                  cartao.dia_fechamento,
                  mes,
                );
                const primeira = mesPrimeiraParcela(
                  c.data_compra,
                  cartao.dia_fechamento,
                );
                const valores = valoresParcelas(
                  Number(c.valor_total),
                  c.parcelas,
                );
                const valorParcela = valores[0];

                // Última parcela (mesmo se não estiver ativa nesse mês)
                const totalMesesUltima = primeira.mes + c.parcelas - 1;
                const anoUltima =
                  primeira.ano + Math.floor((totalMesesUltima - 1) / 12);
                const mesUltimaNum = ((totalMesesUltima - 1) % 12) + 1;
                const ultimaLabel = `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][mesUltimaNum-1]}/${String(anoUltima).slice(2)}`;

                const restantes = info
                  ? c.parcelas - info.numero
                  : primeira.ano * 12 + primeira.mes >
                      mes.ano * 12 + mes.mes
                    ? c.parcelas // ainda não começou
                    : 0; // já terminou
                const valorRestante = info
                  ? Number(
                      valores.slice(info.numero).reduce((s, v) => s + v, 0),
                    )
                  : primeira.ano * 12 + primeira.mes >
                      mes.ano * 12 + mes.mes
                    ? Number(c.valor_total)
                    : 0;

                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{c.descricao}</p>
                        {c.categoria && (
                          <Badge variant="secondary" className="text-[10px]">
                            {c.categoria}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDataBR(c.data_compra)} · Total{" "}
                        <span className="tabular-nums">
                          {formatBRL(c.valor_total)}
                        </span>
                      </p>
                    </div>

                    {c.parcelas === 1 ? (
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {formatBRL(c.valor_total)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          à vista
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Parcela
                          </p>
                          <p className="font-medium tabular-nums">
                            {info ? info.numero : primeira.ano * 12 + primeira.mes > mes.ano * 12 + mes.mes ? "0" : c.parcelas}/{c.parcelas}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Valor da parcela
                          </p>
                          <p className="font-medium tabular-nums">
                            {formatBRL(valorParcela)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Falta pagar
                          </p>
                          <p className="font-medium tabular-nums">
                            {restantes > 0
                              ? formatBRL(valorRestante)
                              : "R$ 0,00"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Última em
                          </p>
                          <p className="font-medium">{ultimaLabel}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <EditCompraTrigger
                        compra={c}
                        diaFechamento={cartao.dia_fechamento}
                      />
                      <CompraActionsMenu
                        id={c.id}
                        cartaoId={cartao.id}
                        descricao={c.descricao}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
