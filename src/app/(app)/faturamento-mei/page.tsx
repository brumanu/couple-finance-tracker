import Link from "next/link";
import { AlertTriangleIcon, BuildingIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { hojeISO } from "@/lib/mes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LIMITE_ANUAL_MEI,
  LIMITE_COM_TOLERANCIA_MEI,
  situacaoMei,
  type SituacaoMei,
} from "@/lib/mei";
import {
  NotaMeiFormDialog,
  EditNotaMeiTrigger,
  type NotaMeiRow,
} from "./nota-form-dialog";
import { NotaMeiActionsMenu } from "./nota-actions-menu";

const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function FaturamentoMeiPage({
  searchParams,
}: PageProps<"/faturamento-mei">) {
  const supabase = await createClient();

  const sp = await searchParams;
  const anoAtual = Number(hojeISO().slice(0, 4));
  const anoParam = Number(typeof sp.ano === "string" ? sp.ano : "");
  const ano =
    Number.isInteger(anoParam) && anoParam >= 2000 && anoParam <= 2100
      ? anoParam
      : anoAtual;

  const [, notasRes, anosRes] = await Promise.all([
    requireSession(),
    supabase
      .from("notas_mei")
      .select("id, empresa, valor, data_emissao")
      .gte("data_emissao", `${ano}-01-01`)
      .lte("data_emissao", `${ano}-12-31`)
      .order("data_emissao", { ascending: false }),
    // Só as datas, pra montar a lista de anos que têm nota.
    supabase.from("notas_mei").select("data_emissao"),
  ]);

  const notas = (notasRes.data ?? []) as NotaMeiRow[];
  const todasDatas = (anosRes.data ?? []) as { data_emissao: string }[];

  const anosDisponiveis = Array.from(
    new Set([
      anoAtual,
      ano,
      ...todasDatas.map((d) => Number(d.data_emissao.slice(0, 4))),
    ]),
  ).sort((a, b) => b - a);

  const total = notas.reduce((s, n) => s + Number(n.valor), 0);
  const situacao = situacaoMei(total);
  const restante = LIMITE_ANUAL_MEI - total;
  const percentual = Math.min(100, (total / LIMITE_ANUAL_MEI) * 100);

  // Empresas já usadas alimentam o autocomplete do formulário.
  const empresas = Array.from(new Set(notas.map((n) => n.empresa))).sort();

  const porEmpresa = new Map<string, { total: number; qtd: number }>();
  for (const n of notas) {
    const atual = porEmpresa.get(n.empresa) ?? { total: 0, qtd: 0 };
    porEmpresa.set(n.empresa, {
      total: atual.total + Number(n.valor),
      qtd: atual.qtd + 1,
    });
  }
  const rankingEmpresas = [...porEmpresa.entries()].sort(
    (a, b) => b[1].total - a[1].total,
  );

  const porMes = Array.from({ length: 12 }, () => 0);
  for (const n of notas) {
    porMes[Number(n.data_emissao.slice(5, 7)) - 1] += Number(n.valor);
  }
  const maiorMes = Math.max(...porMes, 1);
  // Só faz sentido projetar o ano corrente, com meses ainda por vir.
  const mesCorrente = ano === anoAtual ? Number(hojeISO().slice(5, 7)) : 12;
  const projecaoAno = ano === anoAtual ? (total / mesCorrente) * 12 : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
            Faturamento MEI
          </h2>
          <p className="mt-1.5 max-w-[56ch] text-[15px] text-neutral-700">
            Notas emitidas em {ano} e quanto já foi do teto do MEI.
          </p>
        </div>
        <NotaMeiFormDialog empresas={empresas} />
      </header>

      {anosDisponiveis.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {anosDisponiveis.map((a) => (
            <Button
              key={a}
              size="sm"
              variant={a === ano ? "default" : "outline"}
              nativeButton={false}
              render={
                <Link href={`/faturamento-mei?ano=${a}`}>
                  <span className="tabular-nums">{a}</span>
                </Link>
              }
            />
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <ResumoCard
          label={`Total emitido em ${ano}`}
          valor={formatBRL(total)}
          hint={`${notas.length} ${notas.length === 1 ? "nota" : "notas"}`}
          destaque
        />
        <ResumoCard
          label={restante >= 0 ? "Ainda cabe no teto" : "Passou do teto"}
          valor={formatBRL(Math.abs(restante))}
          hint={`teto de ${formatBRL(LIMITE_ANUAL_MEI)}`}
        />
        <ResumoCard
          label={projecaoAno != null ? "Projeção do ano" : "Média por nota"}
          valor={formatBRL(
            projecaoAno != null
              ? projecaoAno
              : notas.length > 0
                ? total / notas.length
                : 0,
          )}
          hint={
            projecaoAno != null
              ? `no ritmo de ${mesCorrente} ${mesCorrente === 1 ? "mês" : "meses"}`
              : "no ano"
          }
        />
      </div>

      <LimiteMei
        total={total}
        percentual={percentual}
        situacao={situacao}
        projecao={projecaoAno}
      />

      {notas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma nota registrada em {ano}.
            </p>
            <NotaMeiFormDialog empresas={empresas} />
          </div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Emissão
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {notas.map((n) => (
                    <tr key={n.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{n.empresa}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {formatDataBR(n.data_emissao)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-primary">
                        {formatBRL(Number(n.valor))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <EditNotaMeiTrigger nota={n} empresas={empresas} />
                          <NotaMeiActionsMenu
                            id={n.id}
                            empresa={n.empresa}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/40">
                  <tr>
                    <td
                      className="px-4 py-3 font-heading text-[15px]"
                      colSpan={2}
                    >
                      Total emitido
                    </td>
                    <td className="px-4 py-3 text-right font-heading tabular-nums text-[17px] text-primary">
                      {formatBRL(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <ul className="flex flex-col divide-y divide-border/60 md:hidden">
              {notas.map((n) => (
                <li key={n.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {n.empresa}
                    </p>
                    <p className="text-[13px] tabular-nums text-neutral-700">
                      {formatDataBR(n.data_emissao)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-[15px] font-medium text-primary">
                    {formatBRL(Number(n.valor))}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <EditNotaMeiTrigger nota={n} empresas={empresas} />
                    <NotaMeiActionsMenu id={n.id} empresa={n.empresa} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3 md:hidden">
              <span className="font-heading text-[15px]">Total emitido</span>
              <span className="font-heading tabular-nums text-[17px] text-primary">
                {formatBRL(total)}
              </span>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="flex flex-col gap-3">
              <h3 className="px-1 font-heading text-[20px]">Por mês</h3>
              <Card>
                <div className="flex flex-col gap-2 p-5">
                  {porMes.map((valor, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-8 shrink-0 text-xs uppercase text-muted-foreground">
                        {MESES_ABREV[i]}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(valor / maiorMes) * 100}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {valor > 0 ? formatBRL(valor) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="px-1 font-heading text-[20px]">Por empresa</h3>
              <Card>
                <div className="flex flex-col divide-y divide-border/60">
                  {rankingEmpresas.map(([empresa, dados]) => (
                    <div
                      key={empresa}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-foreground">
                        <BuildingIcon className="size-4" strokeWidth={2.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">
                          {empresa}
                        </p>
                        <p className="text-[13px] text-neutral-700">
                          {dados.qtd} {dados.qtd === 1 ? "nota" : "notas"} ·{" "}
                          {total > 0
                            ? ((dados.total / total) * 100).toFixed(0)
                            : 0}
                          % do total
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-[15px] font-medium">
                        {formatBRL(dados.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function LimiteMei({
  total,
  percentual,
  situacao,
  projecao,
}: {
  total: number;
  percentual: number;
  situacao: SituacaoMei;
  projecao: number | null;
}) {
  const alerta = situacao === "excedido" || situacao === "desenquadramento";
  const barra =
    situacao === "dentro"
      ? "bg-sage-500"
      : situacao === "atencao"
        ? "bg-accent-500"
        : "bg-primary";

  return (
    <Card className={alerta ? "border border-accent-300 bg-accent-100" : ""}>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-heading text-[17px]">Teto do MEI</p>
          <p className="text-[13px] tabular-nums text-neutral-700">
            {formatBRL(total)} de {formatBRL(LIMITE_ANUAL_MEI)} ·{" "}
            {percentual.toFixed(1)}%
          </p>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barra}`}
            style={{ width: `${percentual}%` }}
          />
        </div>

        {situacao === "dentro" && (
          <p className="text-[13px] text-neutral-700">
            Dentro do limite.
            {projecao != null &&
              projecao > LIMITE_ANUAL_MEI &&
              ` Mas no ritmo atual o ano fecha em ${formatBRL(projecao)} — acima do teto.`}
          </p>
        )}

        {situacao === "atencao" && (
          <p className="text-[13px] text-accent-800">
            Passou de 80% do teto. Ainda dá tempo de segurar emissão ou
            planejar a migração pra ME antes do fim do ano.
          </p>
        )}

        {situacao === "excedido" && (
          <div className="flex items-start gap-2">
            <AlertTriangleIcon
              className="mt-0.5 size-4 shrink-0 text-accent-800"
              strokeWidth={2.75}
            />
            <p className="text-[13px] text-accent-800">
              Estourou o teto em {formatBRL(total - LIMITE_ANUAL_MEI)}. Como
              ficou dentro da tolerância de 20% (até{" "}
              {formatBRL(LIMITE_COM_TOLERANCIA_MEI)}), o enquadramento vale
              até o fim do ano e paga-se o DAS sobre o excedente.
            </p>
          </div>
        )}

        {situacao === "desenquadramento" && (
          <div className="flex items-start gap-2">
            <AlertTriangleIcon
              className="mt-0.5 size-4 shrink-0 text-accent-800"
              strokeWidth={2.75}
            />
            <p className="text-[13px] text-accent-800">
              Passou de {formatBRL(LIMITE_COM_TOLERANCIA_MEI)} — acima da
              tolerância de 20%. O desenquadramento é retroativo ao início do
              ano. Vale falar com a contabilidade.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function ResumoCard({
  label,
  valor,
  hint,
  destaque,
}: {
  label: string;
  valor: string;
  hint?: string;
  destaque?: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-2 p-5">
        <p className="text-[11px] uppercase tracking-widest text-primary">
          {label}
        </p>
        <p
          className={`truncate font-heading tabular-nums ${
            destaque ? "text-primary" : ""
          }`}
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", lineHeight: 1 }}
        >
          {valor}
        </p>
        {hint && (
          <p className="text-xs tabular-nums text-muted-foreground">{hint}</p>
        )}
      </div>
    </Card>
  );
}
