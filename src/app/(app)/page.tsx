import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseMesParam } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import {
  faturaDoMes,
  quinzenaDoCartao,
  type CompraCartaoInfo,
  type AssinaturaCartaoInfo,
} from "@/lib/cartao-calc";
import { BancoIcone } from "@/lib/bancos-icones";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MonthSwitcher } from "./month-switcher";
import { PagarDialog } from "./pagar/pagar-dialog";
import { DesmarcarButton } from "./pagar/desmarcar-button";
import { DespesaFormDialog } from "./despesas/despesa-form-dialog";

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

const QUINZENA_META = {
  15: {
    label: "dia 15",
    subtitle: "Adiantamento",
    tokenBg: "bg-sage-200",
    tokenText: "text-sage-800",
    barra: "bg-sage-500",
    barraSecundaria: "bg-sage-400",
    tag: "sage",
    blob: "bg-sage-300/45",
  },
  30: {
    label: "dia 30",
    subtitle: "Salário final",
    tokenBg: "bg-accent-200",
    tokenText: "text-accent-800",
    barra: "bg-accent-500",
    barraSecundaria: "bg-accent-400",
    tag: "accent",
    blob: "bg-accent-300/45",
  },
} as const;

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const session = await requireSession();
  const supabase = await createClient();

  const params = await searchParams;
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const mes = parseMesParam(mesParam);

  const hoje = new Date().toISOString().slice(0, 10);
  const hojeDia = Number(hoje.slice(8, 10));
  const noMesAtual =
    hoje.slice(0, 7) === `${mes.ano}-${String(mes.mes).padStart(2, "0")}`;

  const [
    rendasRes,
    contasRes,
    lancRes,
    cartoesRes,
    comprasRes,
    bancosRes,
    dividasRes,
    pagDividasRes,
    assinRes,
  ] = await Promise.all([
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
      .lte("data_referencia", mes.ultimoDia)
      .order("data_pagamento", { ascending: false }),
    supabase
      .from("cartoes")
      .select(
        "id, banco_id, apelido, dia_fechamento, dia_vencimento, ativo",
      )
      .eq("ativo", true),
    supabase
      .from("compras_cartao")
      .select(
        "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria",
      ),
    supabase.from("bancos").select("id, nome, cor, icone"),
    supabase.from("dividas").select("id, descricao, valor_total"),
    supabase.from("pagamentos_divida").select("divida_id, valor"),
    supabase
      .from("assinaturas_cartao")
      .select(
        "id, cartao_id, descricao, valor_mensal, categoria, inicio_vigencia, fim_vigencia, ativa",
      )
      .eq("ativa", true),
  ]);

  const rendas = (rendasRes.data ?? []) as RendaRow[];
  const contas = (contasRes.data ?? []) as RecorrenteRow[];
  const lancamentos = (lancRes.data ?? []) as LancamentoRow[];
  const cartoes = (cartoesRes.data ?? []) as {
    id: string;
    banco_id: string;
    apelido: string | null;
    dia_fechamento: number;
    dia_vencimento: number;
  }[];
  const compras = (comprasRes.data ?? []) as CompraCartaoInfo[];
  const assinaturas = (assinRes.data ?? []) as AssinaturaCartaoInfo[];
  const bancos = (bancosRes.data ?? []) as {
    id: string;
    nome: string;
    cor: string;
    icone: string | null;
  }[];
  const bancoById = new Map(bancos.map((b) => [b.id, b]));

  const dividasRaw = (dividasRes.data ?? []) as {
    id: string;
    descricao: string;
    valor_total: number | string;
  }[];
  const pagDividasRaw = (pagDividasRes.data ?? []) as {
    divida_id: string;
    valor: number | string;
  }[];
  const pagoPorDivida = new Map<string, number>();
  for (const p of pagDividasRaw) {
    pagoPorDivida.set(
      p.divida_id,
      (pagoPorDivida.get(p.divida_id) ?? 0) + Number(p.valor),
    );
  }
  const dividasAbertas = dividasRaw
    .map((d) => {
      const pago = pagoPorDivida.get(d.id) ?? 0;
      const total = Number(d.valor_total);
      const restante = Math.max(0, total - pago);
      const progresso = total > 0 ? Math.min(100, (pago / total) * 100) : 0;
      return { id: d.id, descricao: d.descricao, total, pago, restante, progresso };
    })
    .filter((d) => d.restante > 0)
    .sort((a, b) => b.restante - a.restante);
  const totalDividas = dividasAbertas.reduce((s, d) => s + d.restante, 0);

  // Calcula fatura de cada cartão nesse mês
  type FaturaCartao = {
    cartaoId: string;
    label: string;
    bancoNome: string;
    bancoCor: string;
    bancoIcone: string | null;
    total: number;
    quinzena: 15 | 30;
  };
  const faturas: FaturaCartao[] = cartoes
    .map((c) => {
      const banco = bancoById.get(c.banco_id);
      const label = banco?.nome
        ? c.apelido
          ? `${banco.nome} · ${c.apelido}`
          : banco.nome
        : c.apelido ?? "Cartão";
      const f = faturaDoMes(
        {
          id: c.id,
          dia_fechamento: c.dia_fechamento,
          dia_vencimento: c.dia_vencimento,
        },
        compras,
        mes,
        assinaturas,
      );
      return {
        cartaoId: c.id,
        label,
        bancoNome: banco?.nome ?? label,
        bancoCor: banco?.cor ?? "#c67139",
        bancoIcone: banco?.icone ?? null,
        total: f.total,
        quinzena: quinzenaDoCartao(c.dia_vencimento),
      };
    })
    .filter((f) => f.total > 0);

  const pagamentos = new Map<string, LancamentoRow>();
  for (const l of lancamentos) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagamentos.set(l.conta_recorrente_id, l);
    }
  }
  const despesasAvulsas = lancamentos.filter(
    (l) => l.tipo === "despesa_avulsa",
  );

  const quinzenaAtual: 15 | 30 = noMesAtual && hojeDia > 15 ? 30 : 15;
  const proxima: 15 | 30 = quinzenaAtual === 15 ? 30 : 15;

  function calc(q: 15 | 30) {
    const rendasQ = rendas.filter((r) => r.dia_recebimento === q);
    const contasQ = contas.filter((c) => c.quinzena === q);
    const despesasQ = despesasAvulsas.filter((d) => d.quinzena === q);
    const faturasQ = faturas.filter((f) => f.quinzena === q);
    const totalRenda = rendasQ.reduce(
      (s, r) => s + Number(r.valor_previsto),
      0,
    );
    const totalContasRec = contasQ.reduce((s, c) => {
      const pago = pagamentos.get(c.id);
      return s + (pago ? Number(pago.valor) : Number(c.valor_previsto));
    }, 0);
    const totalFaturas = faturasQ.reduce((s, f) => s + f.total, 0);
    const totalContas = totalContasRec + totalFaturas;
    const totalDespesas = despesasQ.reduce((s, d) => s + Number(d.valor), 0);
    return {
      rendas: rendasQ,
      contas: contasQ,
      despesas: despesasQ,
      faturas: faturasQ,
      totalRenda,
      totalContas,
      totalDespesas,
      saldo: totalRenda - totalContas - totalDespesas,
    };
  }

  const atual = calc(quinzenaAtual);
  const outra = calc(proxima);

  const nenhumDado =
    rendas.length === 0 && contas.length === 0 && faturas.length === 0;

  const contasEmAtraso = noMesAtual
    ? atual.contas.filter((c) => {
        const paga = pagamentos.get(c.id);
        if (paga) return false;
        return c.dia_vencimento != null && hojeDia > c.dia_vencimento;
      })
    : [];

  const primeiroNome = session.nome.split(/\s+/)[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Oi, {primeiroNome}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {noMesAtual
              ? `Isto é o que sobra nesta quinzena e na próxima em ${mes.label}.`
              : `Estimativa para ${mes.label}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher mes={mes} />
          <div className="hidden md:block">
            <DespesaFormDialog />
          </div>
        </div>
      </header>

      {nenhumDado ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não tem nenhuma renda ou conta cadastrada em {mes.label}.
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
                render={
                  <Link href="/recorrentes">Cadastrar contas</Link>
                }
              />
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[1.55fr_1fr]">
            <QuinzenaHeroCard
              quinzena={quinzenaAtual}
              dados={atual}
              titulo="Sobra nesta quinzena"
            />
            <QuinzenaResumoCard quinzena={proxima} dados={outra} />
          </div>

          {contasEmAtraso.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-accent-300 bg-accent-100 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <AlertTriangleIcon className="size-4" strokeWidth={2.75} />
              </div>
              <div className="flex-1">
                <p className="font-heading text-lg text-accent-800">
                  {contasEmAtraso.length === 1
                    ? "1 conta em atraso"
                    : `${contasEmAtraso.length} contas em atraso`}
                </p>
                <p className="text-sm text-accent-800/80">
                  {contasEmAtraso.map((c) => c.descricao).join(", ")}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <ContasQuinzenaCard
              quinzena={quinzenaAtual}
              contas={atual.contas}
              faturas={atual.faturas}
              pagamentos={pagamentos}
              mes={mes}
              hojeDia={hojeDia}
              noMesAtual={noMesAtual}
            />
            <UltimasDespesasCard despesas={despesasAvulsas.slice(0, 6)} />
          </div>

          {dividasAbertas.length > 0 && (
            <DividasCard
              total={totalDividas}
              topDividas={dividasAbertas.slice(0, 3)}
              temMais={dividasAbertas.length > 3}
            />
          )}
        </>
      )}
    </div>
  );
}

function DividasCard({
  total,
  topDividas,
  temMais,
}: {
  total: number;
  topDividas: {
    id: string;
    descricao: string;
    total: number;
    pago: number;
    restante: number;
    progresso: number;
  }[];
  temMais: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-primary">
              Dívidas em aberto
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Não entra no saldo — é só pra não esquecer.
            </p>
          </div>
          <p
            className="font-heading tabular-nums text-primary"
            style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", lineHeight: 1 }}
          >
            {formatBRL(total)}
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {topDividas.map((d) => (
            <li key={d.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{d.descricao}</p>
                <p className="whitespace-nowrap text-sm tabular-nums text-primary">
                  {formatBRL(d.restante)}
                </p>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="bg-primary/70"
                  style={{ width: `${d.progresso}%` }}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          {temMais && (
            <p className="text-xs text-muted-foreground">
              +{topDividas.length === 3 ? "outras" : ""} não mostradas
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            className="ml-auto"
            render={
              <Link href="/dividas">
                Ver dívidas
                <ChevronRightIcon className="size-4" strokeWidth={2.75} />
              </Link>
            }
          />
        </div>
      </div>
    </Card>
  );
}

type FaturaResumo = {
  cartaoId: string;
  label: string;
  bancoNome: string;
  bancoCor: string;
  bancoIcone: string | null;
  total: number;
  quinzena: 15 | 30;
};

type CalcResult = {
  rendas: RendaRow[];
  contas: RecorrenteRow[];
  despesas: LancamentoRow[];
  faturas: FaturaResumo[];
  totalRenda: number;
  totalContas: number;
  totalDespesas: number;
  saldo: number;
};

function QuinzenaHeroCard({
  quinzena,
  dados,
  titulo,
}: {
  quinzena: 15 | 30;
  dados: CalcResult;
  titulo: string;
}) {
  const meta = QUINZENA_META[quinzena];
  const total = dados.totalRenda || 1;
  const pctContas = Math.min(100, (dados.totalContas / total) * 100);
  const pctDespesas = Math.min(
    100 - pctContas,
    (dados.totalDespesas / total) * 100,
  );
  const pctLivre = Math.max(0, 100 - pctContas - pctDespesas);

  return (
    <Card className="relative overflow-hidden">
      <div
        className={`pointer-events-none absolute -right-16 -top-16 size-56 rounded-full ${meta.blob}`}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 p-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            {titulo}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quinzena {meta.label} · {meta.subtitle}
          </p>
        </div>

        <p
          className={`font-heading tabular-nums ${dados.saldo >= 0 ? "text-foreground" : "text-primary"}`}
          style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", lineHeight: 1 }}
        >
          {formatBRL(dados.saldo)}
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-200">
            {pctContas > 0 && (
              <div
                className={meta.barra}
                style={{ width: `${pctContas}%` }}
                title={`Contas ${formatBRL(dados.totalContas)}`}
              />
            )}
            {pctDespesas > 0 && (
              <div
                className={meta.barraSecundaria}
                style={{ width: `${pctDespesas}%` }}
                title={`Despesas ${formatBRL(dados.totalDespesas)}`}
              />
            )}
            {pctLivre > 0 && (
              <div
                className="bg-neutral-300"
                style={{ width: `${pctLivre}%` }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <LegendaDot
              className={meta.barra}
              label="Contas"
              valor={dados.totalContas}
            />
            <LegendaDot
              className={meta.barraSecundaria}
              label="Despesas"
              valor={dados.totalDespesas}
            />
            <LegendaDot
              className="bg-neutral-300"
              label="Renda"
              valor={dados.totalRenda}
              muted
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function QuinzenaResumoCard({
  quinzena,
  dados,
}: {
  quinzena: 15 | 30;
  dados: CalcResult;
}) {
  const meta = QUINZENA_META[quinzena];
  return (
    <Card>
      <div className="flex flex-col gap-4 p-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Próxima quinzena · {meta.label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>
        <p
          className="font-heading tabular-nums"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", lineHeight: 1 }}
        >
          {formatBRL(dados.saldo)}
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <ResumoLinha label="Renda" valor={dados.totalRenda} />
          <ResumoLinha
            label="Contas"
            valor={-dados.totalContas}
            variant="danger"
          />
          <ResumoLinha
            label="Despesas"
            valor={-dados.totalDespesas}
            variant="danger"
          />
        </div>
      </div>
    </Card>
  );
}

function LegendaDot({
  className,
  label,
  valor,
  muted,
}: {
  className: string;
  label: string;
  valor: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block size-2 rounded-full ${className}`} />
      <span className={muted ? "text-muted-foreground" : "text-foreground/80"}>
        {label}{" "}
        <span className="font-medium tabular-nums text-foreground">
          {formatBRL(valor)}
        </span>
      </span>
    </div>
  );
}

function ResumoLinha({
  label,
  valor,
  variant,
}: {
  label: string;
  valor: number;
  variant?: "danger";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums font-medium ${variant === "danger" ? "text-primary" : "text-foreground"}`}
      >
        {valor < 0 ? "−" : ""}
        {formatBRL(Math.abs(valor))}
      </span>
    </div>
  );
}

function ContasQuinzenaCard({
  quinzena,
  contas,
  faturas,
  pagamentos,
  mes,
  hojeDia,
  noMesAtual,
}: {
  quinzena: 15 | 30;
  contas: RecorrenteRow[];
  faturas: FaturaResumo[];
  pagamentos: Map<string, LancamentoRow>;
  mes: { primeiroDia: string; label: string; chave: string };
  hojeDia: number;
  noMesAtual: boolean;
}) {
  const semItens = contas.length === 0 && faturas.length === 0;
  return (
    <Card>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-baseline justify-between">
          <p className="font-heading text-lg">Contas desta quinzena</p>
          <p className="text-xs text-muted-foreground">{mes.label}</p>
        </div>
        {semItens ? (
          <p className="text-sm text-muted-foreground">
            Nada cadastrado para o dia {quinzena}.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {faturas.map((f) => (
              <li
                key={f.cartaoId}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <BancoIcone
                  icone={f.bancoIcone}
                  corFallback={f.bancoCor}
                  nomeFallback={f.bancoNome}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">Fatura {f.label}</p>
                  <p className="text-xs text-muted-foreground">Cartão</p>
                </div>
                <span className="tabular-nums text-sm font-medium">
                  {formatBRL(f.total)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  aria-label="Ver fatura"
                  render={
                    <Link href={`/cartoes/${f.cartaoId}?mes=${mes.chave}`}>
                      <ChevronRightIcon
                        className="size-4"
                        strokeWidth={2.75}
                      />
                    </Link>
                  }
                />
              </li>
            ))}
            {contas.map((c) => {
              const pago = pagamentos.get(c.id);
              const atrasada =
                noMesAtual &&
                !pago &&
                c.dia_vencimento != null &&
                hojeDia > c.dia_vencimento;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      pago
                        ? "bg-sage-300 text-sage-800"
                        : atrasada
                          ? "bg-primary text-primary-foreground"
                          : "bg-neutral-200 text-foreground"
                    }`}
                  >
                    {pago ? (
                      <CheckIcon className="size-4" strokeWidth={2.75} />
                    ) : atrasada ? (
                      <AlertTriangleIcon
                        className="size-4"
                        strokeWidth={2.75}
                      />
                    ) : (
                      <span className="font-heading text-xs">
                        {c.descricao[0]?.toUpperCase() ?? "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${pago ? "text-muted-foreground line-through" : ""}`}
                    >
                      {c.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pago
                        ? `Paga${pago.data_pagamento ? " em " + formatDataCurta(pago.data_pagamento) : ""}`
                        : c.dia_vencimento
                          ? atrasada
                            ? `Venceu dia ${c.dia_vencimento}`
                            : `Vence dia ${c.dia_vencimento}`
                          : ""}
                    </p>
                  </div>
                  <span
                    className={`tabular-nums text-sm font-medium ${pago ? "text-muted-foreground line-through" : ""}`}
                  >
                    {formatBRL(pago ? pago.valor : c.valor_previsto)}
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function UltimasDespesasCard({ despesas }: { despesas: LancamentoRow[] }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-baseline justify-between">
          <p className="font-heading text-lg">Últimas despesas</p>
          <Link
            href="/despesas"
            className="text-xs text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {despesas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma despesa lançada neste mês.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {despesas.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 font-heading text-xs text-foreground">
                  {d.descricao[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{d.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.data_pagamento
                      ? formatDataCurta(d.data_pagamento)
                      : ""}
                    {d.categoria ? ` · ${d.categoria}` : ""}
                    {d.quinzena ? ` · quinzena ${d.quinzena}` : ""}
                  </p>
                </div>
                <span className="tabular-nums text-sm font-medium text-primary">
                  −{formatBRL(d.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function formatDataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
