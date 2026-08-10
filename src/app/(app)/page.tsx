import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseMesParam } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MonthSwitcher } from "./month-switcher";
import { PagarDialog } from "./pagar/pagar-dialog";
import { DesmarcarButton } from "./pagar/desmarcar-button";

type RendaRow = {
  descricao: string;
  valor_previsto: number | string;
  dia_recebimento: number;
};

type RecorrenteRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  quinzena: number;
  dia_vencimento: number | null;
  categoria: string | null;
};

type LancamentoRow = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number | string;
  data_pagamento: string | null;
  quinzena: number | null;
  categoria: string | null;
  conta_recorrente_id: string | null;
};

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  await requireSession();
  const supabase = await createClient();

  const params = await searchParams;
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const mes = parseMesParam(mesParam);

  const [rendasRes, contasRes, lancRes] = await Promise.all([
    supabase
      .from("rendas")
      .select("descricao, valor_previsto, dia_recebimento")
      .eq("ativa", true),
    supabase
      .from("contas_recorrentes")
      .select(
        "id, descricao, valor_previsto, quinzena, dia_vencimento, categoria, inicio_vigencia, fim_vigencia",
      )
      .eq("ativa", true)
      .lte("inicio_vigencia", mes.ultimoDia)
      .or(`fim_vigencia.is.null,fim_vigencia.gte.${mes.primeiroDia}`),
    supabase
      .from("lancamentos")
      .select(
        "id, tipo, descricao, valor, data_pagamento, quinzena, categoria, conta_recorrente_id",
      )
      .gte("data_referencia", mes.primeiroDia)
      .lte("data_referencia", mes.ultimoDia),
  ]);

  const rendas = (rendasRes.data ?? []) as RendaRow[];
  const contas = (contasRes.data ?? []) as RecorrenteRow[];
  const lancamentos = (lancRes.data ?? []) as LancamentoRow[];

  // Mapa recorrenteId -> lancamento (para substituir previsto por real)
  const pagamentos = new Map<string, LancamentoRow>();
  for (const l of lancamentos) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagamentos.set(l.conta_recorrente_id, l);
    }
  }

  const despesasAvulsas = lancamentos.filter(
    (l) => l.tipo === "despesa_avulsa",
  );

  const quinzenas = [15, 30] as const;
  const resumo = quinzenas.map((q) => {
    const rendasQ = rendas.filter((r) => r.dia_recebimento === q);
    const contasQ = contas.filter((c) => c.quinzena === q);
    const despesasQ = despesasAvulsas.filter((d) => d.quinzena === q);

    const totalRenda = rendasQ.reduce(
      (sum, r) => sum + Number(r.valor_previsto),
      0,
    );

    // Contas: usa valor pago se existe lancamento, senão usa previsto
    const totalContas = contasQ.reduce((sum, c) => {
      const pago = pagamentos.get(c.id);
      return sum + (pago ? Number(pago.valor) : Number(c.valor_previsto));
    }, 0);

    const totalDespesas = despesasQ.reduce(
      (sum, d) => sum + Number(d.valor),
      0,
    );

    return {
      quinzena: q,
      rendas: rendasQ,
      contas: contasQ,
      despesas: despesasQ,
      totalRenda,
      totalContas,
      totalDespesas,
      saldo: totalRenda - totalContas - totalDespesas,
    };
  });

  const rendaTotal = resumo.reduce((sum, r) => sum + r.totalRenda, 0);
  const contasTotal = resumo.reduce((sum, r) => sum + r.totalContas, 0);
  const despesasTotal = resumo.reduce((sum, r) => sum + r.totalDespesas, 0);
  const saldoTotal = rendaTotal - contasTotal - despesasTotal;
  const nenhumDado =
    rendas.length === 0 && contas.length === 0 && despesasAvulsas.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Saldo por quinzena — atualiza conforme você paga contas e lança
            despesas.
          </p>
        </div>
        <MonthSwitcher mes={mes} />
      </div>

      {nenhumDado ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma renda ou conta cadastrada para {mes.label}.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/rendas">Cadastrar rendas</Link>}
              />
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/recorrentes">Cadastrar contas</Link>}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Renda
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatBRL(rendaTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Contas
                </p>
                <p className="text-xl font-semibold tabular-nums text-red-600">
                  −{formatBRL(contasTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Despesas
                </p>
                <p className="text-xl font-semibold tabular-nums text-red-600">
                  −{formatBRL(despesasTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Saldo
                </p>
                <p
                  className={`text-xl font-semibold tabular-nums ${
                    saldoTotal >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatBRL(saldoTotal)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {resumo.map((q) => (
              <Card key={q.quinzena}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Quinzena do dia {q.quinzena}</CardTitle>
                    <Badge
                      variant={q.saldo >= 0 ? "default" : "destructive"}
                      className="tabular-nums"
                    >
                      {formatBRL(q.saldo)}
                    </Badge>
                  </div>
                  <CardDescription>
                    {q.quinzena === 15 ? "Adiantamento" : "Salário final"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-emerald-50 p-2 dark:bg-emerald-950/30">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Renda
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatBRL(q.totalRenda)}
                      </p>
                    </div>
                    <div className="rounded-md bg-red-50 p-2 dark:bg-red-950/30">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Contas
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-red-700 dark:text-red-400">
                        −{formatBRL(q.totalContas)}
                      </p>
                    </div>
                    <div className="rounded-md bg-red-50 p-2 dark:bg-red-950/30">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Despesas
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-red-700 dark:text-red-400">
                        −{formatBRL(q.totalDespesas)}
                      </p>
                    </div>
                  </div>

                  {q.rendas.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Rendas
                      </p>
                      {q.rendas.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="truncate">{r.descricao}</span>
                          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                            {formatBRL(r.valor_previsto)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.contas.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Contas
                      </p>
                      {q.contas.map((c) => {
                        const pago = pagamentos.get(c.id);
                        const valor = pago
                          ? Number(pago.valor)
                          : Number(c.valor_previsto);
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {c.descricao}
                              {c.dia_vencimento && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  (dia {c.dia_vencimento})
                                </span>
                              )}
                              {pago && (
                                <Badge
                                  variant="secondary"
                                  className="ml-2 h-4 text-[10px]"
                                >
                                  paga
                                </Badge>
                              )}
                            </span>
                            <span
                              className={`whitespace-nowrap tabular-nums ${
                                pago
                                  ? "font-medium text-foreground"
                                  : "text-red-700 dark:text-red-400"
                              }`}
                            >
                              −{formatBRL(valor)}
                            </span>
                            {pago ? (
                              <DesmarcarButton
                                lancamentoId={pago.id}
                                descricao={c.descricao}
                              />
                            ) : (
                              <PagarDialog
                                contaRecorrenteId={c.id}
                                descricao={c.descricao}
                                valorPrevisto={c.valor_previsto}
                                dataReferencia={mes.primeiroDia}
                                quinzena={c.quinzena as 15 | 30}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.despesas.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Despesas
                      </p>
                      {q.despesas.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {d.descricao}
                            {d.categoria && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                · {d.categoria}
                              </span>
                            )}
                          </span>
                          <span className="whitespace-nowrap tabular-nums text-red-700 dark:text-red-400">
                            −{formatBRL(d.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.rendas.length === 0 &&
                    q.contas.length === 0 &&
                    q.despesas.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhum lançamento nesta quinzena.
                      </p>
                    )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
