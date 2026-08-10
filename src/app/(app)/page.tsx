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

type RendaRow = {
  descricao: string;
  valor_previsto: number | string;
  dia_recebimento: number;
};

type RecorrenteRow = {
  descricao: string;
  valor_previsto: number | string;
  quinzena: number;
  dia_vencimento: number | null;
  categoria: string | null;
};

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  await requireSession();
  const supabase = await createClient();

  const params = await searchParams;
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const mes = parseMesParam(mesParam);

  const [rendasRes, contasRes] = await Promise.all([
    supabase
      .from("rendas")
      .select("descricao, valor_previsto, dia_recebimento")
      .eq("ativa", true),
    supabase
      .from("contas_recorrentes")
      .select("descricao, valor_previsto, quinzena, dia_vencimento, categoria, inicio_vigencia, fim_vigencia")
      .eq("ativa", true)
      .lte("inicio_vigencia", mes.ultimoDia)
      .or(`fim_vigencia.is.null,fim_vigencia.gte.${mes.primeiroDia}`),
  ]);

  const rendas = (rendasRes.data ?? []) as RendaRow[];
  const contas = (contasRes.data ?? []) as RecorrenteRow[];

  const quinzenas = [15, 30] as const;
  const resumo = quinzenas.map((q) => {
    const rendasQ = rendas.filter((r) => r.dia_recebimento === q);
    const contasQ = contas.filter((c) => c.quinzena === q);
    const totalRenda = rendasQ.reduce(
      (sum, r) => sum + Number(r.valor_previsto),
      0,
    );
    const totalContas = contasQ.reduce(
      (sum, c) => sum + Number(c.valor_previsto),
      0,
    );
    return {
      quinzena: q,
      rendas: rendasQ,
      contas: contasQ,
      totalRenda,
      totalContas,
      saldo: totalRenda - totalContas,
    };
  });

  const rendaTotal = resumo.reduce((sum, r) => sum + r.totalRenda, 0);
  const contasTotal = resumo.reduce((sum, r) => sum + r.totalContas, 0);
  const saldoTotal = rendaTotal - contasTotal;
  const nenhumDado = rendas.length === 0 && contas.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Previsão de rendas e contas por quinzena.
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
            <CardContent className="grid grid-cols-3 gap-4 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Renda total
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatBRL(rendaTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Contas total
                </p>
                <p className="text-xl font-semibold tabular-nums text-red-600">
                  −{formatBRL(contasTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Saldo previsto
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/30">
                      <p className="text-xs text-muted-foreground">
                        Renda prevista
                      </p>
                      <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatBRL(q.totalRenda)}
                      </p>
                    </div>
                    <div className="rounded-md bg-red-50 p-3 dark:bg-red-950/30">
                      <p className="text-xs text-muted-foreground">Contas</p>
                      <p className="font-semibold tabular-nums text-red-700 dark:text-red-400">
                        −{formatBRL(q.totalContas)}
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
                      {q.contas.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate">
                            {c.descricao}
                            {c.dia_vencimento && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                (dia {c.dia_vencimento})
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-red-700 dark:text-red-400">
                            −{formatBRL(c.valor_previsto)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.rendas.length === 0 && q.contas.length === 0 && (
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
