import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hojeISO, mesProximo, parseMesParam, type MesRef } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import {
  faturaDoMes,
  quinzenaDoCartao,
  type CompraCartaoInfo,
  type AssinaturaCartaoInfo,
} from "@/lib/cartao-calc";
import { BancoIcone } from "@/lib/bancos-icones";
import { getCartoesParaSelecao } from "@/lib/cartoes-selection";
import { getCategorias } from "@/lib/categorias-server";
import { Badge } from "@/components/ui/badge";
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
  inicio_vigencia: string;
  fim_vigencia: string | null;
};

type LancamentoRow = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number | string;
  data_referencia: string;
  data_pagamento: string | null;
  quinzena: number | null;
  categoria: string | null;
  conta_recorrente_id: string | null;
};

type CartaoRow = {
  id: string;
  banco_id: string;
  apelido: string | null;
  dia_fechamento: number;
  dia_vencimento: number;
};

type BancoRow = {
  id: string;
  nome: string;
  cor: string;
  icone: string | null;
};

const QUINZENA_META = {
  15: {
    label: "dia 15",
    subtitle: "Adiantamento",
    barra: "bg-sage-500",
  },
  30: {
    label: "dia 30",
    subtitle: "Salário final",
    barra: "bg-accent-500",
  },
} as const;

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

const HISTORICO_MESES = 6;

type CalcMes = {
  totalRenda: number;
  totalContasRec: number;
  totalCartoes: number;
  totalDespesas: number;
  saldo: number;
};

type CalcQuinzena = CalcMes & {
  quinzena: 15 | 30;
  rendas: RendaRow[];
  contas: RecorrenteRow[];
  despesas: LancamentoRow[];
  faturas: FaturaResumo[];
};

type FaturaResumo = {
  cartaoId: string;
  label: string;
  bancoNome: string;
  bancoCor: string;
  bancoIcone: string | null;
  total: number;
  quinzena: 15 | 30;
};

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const supabase = await createClient();
  const params = await searchParams;
  const mesParam = typeof params.mes === "string" ? params.mes : undefined;
  const mes = parseMesParam(mesParam);

  const hoje = hojeISO();
  const hojeDia = Number(hoje.slice(8, 10));
  const noMesAtual =
    hoje.slice(0, 7) === `${mes.ano}-${String(mes.mes).padStart(2, "0")}`;

  // Range: mês selecionado + 5 próximos (projeção)
  const mesesHistorico: MesRef[] = [];
  let cursor = mes;
  for (let i = 0; i < HISTORICO_MESES; i += 1) {
    mesesHistorico.push(cursor);
    cursor = mesProximo(cursor);
  }
  const primeiroDiaRange = mesesHistorico[0].primeiroDia;
  const ultimoDiaRange = mesesHistorico[mesesHistorico.length - 1].ultimoDia;

  // Cutoff for compras_cartao: a purchase from more than 60 months before the
  // earliest displayed month can't have active installments (max parcelas = 60).
  const cutoffDate = new Date(
    mesesHistorico[0].ano,
    mesesHistorico[0].mes - 1 - 60,
    1,
  );
  const comprasCutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-01`;

  // Nenhuma dessas depende das outras (RLS escopa por cookie de sessão),
  // então tudo roda em paralelo em vez de esperar sessão/cartões/categorias
  // resolverem antes de disparar as queries do dashboard.
  const [
    session,
    cartoesSel,
    categorias,
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
    requireSession(),
    getCartoesParaSelecao(),
    getCategorias(),
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
      .or(`fim_vigencia.is.null,fim_vigencia.gte.${primeiroDiaRange}`),
    supabase
      .from("lancamentos")
      .select(
        "id, tipo, descricao, valor, data_referencia, data_pagamento, quinzena, categoria, conta_recorrente_id",
      )
      .gte("data_referencia", primeiroDiaRange)
      .lte("data_referencia", ultimoDiaRange)
      .order("data_pagamento", { ascending: false }),
    supabase
      .from("cartoes")
      .select("id, banco_id, apelido, dia_fechamento, dia_vencimento, ativo")
      .eq("ativo", true),
    supabase
      .from("compras_cartao")
      .select(
        "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria",
      )
      .gte("data_compra", comprasCutoff),
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
  const contasAll = (contasRes.data ?? []) as RecorrenteRow[];
  const lancamentos = (lancRes.data ?? []) as LancamentoRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
  const compras = (comprasRes.data ?? []) as CompraCartaoInfo[];
  const assinaturas = (assinRes.data ?? []) as AssinaturaCartaoInfo[];
  const bancos = (bancosRes.data ?? []) as BancoRow[];
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
      return {
        id: d.id,
        descricao: d.descricao,
        total,
        pago,
        restante,
        progresso,
      };
    })
    .filter((d) => d.restante > 0)
    .sort((a, b) => b.restante - a.restante);
  const totalDividas = dividasAbertas.reduce((s, d) => s + d.restante, 0);

  function faturasDoMes(mesRef: MesRef): FaturaResumo[] {
    return cartoes
      .map((c) => {
        const banco = bancoById.get(c.banco_id);
        const label = banco?.nome
          ? c.apelido
            ? `${banco.nome} · ${c.apelido}`
            : banco.nome
          : (c.apelido ?? "Cartão");
        const f = faturaDoMes(
          {
            id: c.id,
            dia_fechamento: c.dia_fechamento,
            dia_vencimento: c.dia_vencimento,
          },
          compras,
          mesRef,
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
  }

  function contasVigentesNoMes(mesRef: MesRef): RecorrenteRow[] {
    return contasAll.filter(
      (c) =>
        c.inicio_vigencia <= mesRef.ultimoDia &&
        (c.fim_vigencia === null || c.fim_vigencia >= mesRef.primeiroDia),
    );
  }

  function lancamentosDoMes(mesRef: MesRef): LancamentoRow[] {
    return lancamentos.filter(
      (l) =>
        l.data_referencia >= mesRef.primeiroDia &&
        l.data_referencia <= mesRef.ultimoDia,
    );
  }

  function calcMes(mesRef: MesRef): CalcMes {
    const lancsMes = lancamentosDoMes(mesRef);
    const contasMes = contasVigentesNoMes(mesRef);
    const faturas = faturasDoMes(mesRef);
    const pagosMes = new Map<string, LancamentoRow>();
    for (const l of lancsMes) {
      if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
        pagosMes.set(l.conta_recorrente_id, l);
      }
    }
    const totalRenda = rendas.reduce(
      (s, r) => s + Number(r.valor_previsto),
      0,
    );
    const totalContasRec = contasMes.reduce((s, c) => {
      const pago = pagosMes.get(c.id);
      return s + (pago ? Number(pago.valor) : Number(c.valor_previsto));
    }, 0);
    const totalCartoes = faturas.reduce((s, f) => s + f.total, 0);
    const totalDespesas = lancsMes
      .filter((l) => l.tipo === "despesa_avulsa")
      .reduce((s, l) => s + Number(l.valor), 0);
    return {
      totalRenda,
      totalContasRec,
      totalCartoes,
      totalDespesas,
      saldo: totalRenda - totalContasRec - totalCartoes - totalDespesas,
    };
  }

  function calcQuinzena(q: 15 | 30, mesRef: MesRef): CalcQuinzena {
    const lancsMes = lancamentosDoMes(mesRef);
    const faturas = faturasDoMes(mesRef);
    const pagosMes = new Map<string, LancamentoRow>();
    for (const l of lancsMes) {
      if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
        pagosMes.set(l.conta_recorrente_id, l);
      }
    }
    const rendasQ = rendas.filter((r) => r.dia_recebimento === q);
    const contasQ = contasVigentesNoMes(mesRef).filter(
      (c) => c.quinzena === q,
    );
    const despesasQ = lancsMes.filter(
      (l) => l.tipo === "despesa_avulsa" && l.quinzena === q,
    );
    const faturasQ = faturas.filter((f) => f.quinzena === q);
    const totalRenda = rendasQ.reduce(
      (s, r) => s + Number(r.valor_previsto),
      0,
    );
    const totalContasRec = contasQ.reduce((s, c) => {
      const pago = pagosMes.get(c.id);
      return s + (pago ? Number(pago.valor) : Number(c.valor_previsto));
    }, 0);
    const totalCartoes = faturasQ.reduce((s, f) => s + f.total, 0);
    const totalDespesas = despesasQ.reduce((s, l) => s + Number(l.valor), 0);
    return {
      quinzena: q,
      rendas: rendasQ,
      contas: contasQ,
      despesas: despesasQ,
      faturas: faturasQ,
      totalRenda,
      totalContasRec,
      totalCartoes,
      totalDespesas,
      saldo: totalRenda - totalContasRec - totalCartoes - totalDespesas,
    };
  }

  const dadosMes = calcMes(mes);
  const q15 = calcQuinzena(15, mes);
  const q30 = calcQuinzena(30, mes);

  const historico = mesesHistorico.map((m) => ({
    mes: m,
    calc: calcMes(m),
  }));

  const pagamentosMes = new Map<string, LancamentoRow>();
  const lancsMesAtual = lancamentosDoMes(mes);
  for (const l of lancsMesAtual) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagamentosMes.set(l.conta_recorrente_id, l);
    }
  }
  const despesasAvulsasMes = lancsMesAtual
    .filter((l) => l.tipo === "despesa_avulsa")
    .sort((a, b) =>
      (b.data_pagamento ?? "").localeCompare(a.data_pagamento ?? ""),
    );

  const quinzenaAtual: 15 | 30 = noMesAtual && hojeDia > 15 ? 30 : 15;
  const quinzenaAtualDados = quinzenaAtual === 15 ? q15 : q30;

  const nenhumDado =
    rendas.length === 0 &&
    contasAll.length === 0 &&
    dadosMes.totalCartoes === 0;

  const contasEmAtraso = noMesAtual
    ? quinzenaAtualDados.contas.filter((c) => {
        const paga = pagamentosMes.get(c.id);
        if (paga) return false;
        return c.dia_vencimento != null && hojeDia > c.dia_vencimento;
      })
    : [];

  const primeiroNome = session.nome.split(/\s+/)[0];
  const contextoHoje = noMesAtual ? saudacaoContexto(hojeDia) : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-8 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
            Oi, {primeiroNome}
          </h2>
          <p className="mt-1.5 text-[15px] text-neutral-700">
            {contextoHoje ?? `Estimativa para ${mes.label}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher mes={mes} />
          <div className="hidden md:block">
            <DespesaFormDialog cartoes={cartoesSel} categorias={categorias} />
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
                render={<Link href="/recorrentes">Cadastrar contas</Link>}
              />
            </div>
          </div>
        </Card>
      ) : (
        <>
          <SobraMesHeroCard
            dados={dadosMes}
            mesLabel={mes.label}
            noMesAtual={noMesAtual}
          />

          <SobraHistoricoChart
            historico={historico}
            selecionadaChave={mes.chave}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <QuinzenaSaldoCard
              dados={q15}
              ehAtual={noMesAtual && quinzenaAtual === 15}
            />
            <QuinzenaSaldoCard
              dados={q30}
              ehAtual={noMesAtual && quinzenaAtual === 30}
            />
          </div>

          {contasEmAtraso.length > 0 && (
            <div className="flex items-center gap-4 rounded-[26px] border border-accent-300 bg-accent-100 px-5 py-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <AlertTriangleIcon className="size-5" strokeWidth={2.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[17px] text-accent-800">
                  {contasEmAtraso.length === 1
                    ? `A ${contasEmAtraso[0].descricao.toLowerCase()} venceu`
                    : `${contasEmAtraso.length} contas em atraso`}
                </p>
                <p className="text-sm text-accent-800/85">
                  {contasEmAtraso.length === 1
                    ? `${formatBRL(contasEmAtraso[0].valor_previsto)} · vencimento dia ${contasEmAtraso[0].dia_vencimento}`
                    : contasEmAtraso.map((c) => c.descricao).join(", ")}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <ContasQuinzenaCard
              quinzena={quinzenaAtual}
              contas={quinzenaAtualDados.contas}
              faturas={quinzenaAtualDados.faturas}
              pagamentos={pagamentosMes}
              mes={mes}
              hojeDia={hojeDia}
              noMesAtual={noMesAtual}
            />
            <UltimasDespesasCard despesas={despesasAvulsasMes.slice(0, 6)} />
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

function SobraMesHeroCard({
  dados,
  mesLabel,
  noMesAtual,
}: {
  dados: CalcMes;
  mesLabel: string;
  noMesAtual: boolean;
}) {
  const totalGastos =
    dados.totalContasRec + dados.totalCartoes + dados.totalDespesas;
  const pctGasto = dados.totalRenda > 0
    ? Math.min(100, (totalGastos / dados.totalRenda) * 100)
    : 0;
  const pctLivre = Math.max(0, 100 - pctGasto);

  return (
    <div className="relative flex flex-col gap-5 overflow-hidden rounded-[28px] bg-card p-7 md:gap-6 md:p-8">
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full bg-accent-200/70"
        aria-hidden
      />
      <div className="relative flex flex-col gap-1.5">
        <p className="text-[11px] uppercase tracking-widest text-accent-700">
          Sobra em {mesLabel}
          {noMesAtual ? " · mês corrente" : ""}
        </p>
        <p
          className={`font-heading tabular-nums ${dados.saldo >= 0 ? "text-foreground" : "text-primary"}`}
          style={{
            fontSize: "clamp(2.75rem, 6vw, 4.125rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {formatBRL(dados.saldo)}
        </p>
        <p className="mt-1 max-w-[52ch] text-[15px] text-neutral-800">
          {dados.saldo >= 0
            ? "É o que sobra depois de contas, cartões e despesas do mês."
            : "O previsto já supera as entradas do mês — atenção aos próximos gastos."}
        </p>
      </div>

      <div className="relative grid gap-3 sm:grid-cols-4">
        <ResumoBloco
          label="Entradas"
          valor={dados.totalRenda}
          tom="positivo"
        />
        <ResumoBloco
          label="Contas"
          valor={dados.totalContasRec}
          tom="gasto"
        />
        <ResumoBloco
          label="Cartões"
          valor={dados.totalCartoes}
          tom="gasto"
        />
        <ResumoBloco
          label="Despesas"
          valor={dados.totalDespesas}
          tom="gasto"
        />
      </div>

      <div className="relative flex flex-col gap-2">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className={dados.saldo >= 0 ? "bg-accent-500" : "bg-primary"}
            style={{ width: `${pctGasto}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[13px] text-neutral-700">
          <span>{Math.round(pctGasto)}% do previsto comprometido</span>
          <span className="tabular-nums">
            Livre {Math.round(pctLivre)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function ResumoBloco({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: number;
  tom: "positivo" | "gasto";
}) {
  return (
    <div className="rounded-[18px] bg-surface-soft px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-neutral-700">
        {label}
      </p>
      <p
        className={`mt-1.5 font-heading tabular-nums ${
          tom === "gasto" && valor > 0 ? "text-primary" : "text-foreground"
        }`}
        style={{ fontSize: "clamp(1rem, 2.4vw, 1.25rem)", lineHeight: 1.1 }}
      >
        {tom === "gasto" && valor > 0 ? "−" : ""}
        {formatBRL(valor)}
      </p>
    </div>
  );
}

function SobraHistoricoChart({
  historico,
  selecionadaChave,
}: {
  historico: { mes: MesRef; calc: CalcMes }[];
  selecionadaChave: string;
}) {
  const maxAbs = historico.reduce(
    (m, h) => Math.max(m, Math.abs(h.calc.saldo)),
    0,
  );
  const temSaldoNegativo = historico.some((h) => h.calc.saldo < 0);
  const alturaBarra = 128; // px

  return (
    <div className="flex flex-col gap-4 rounded-[26px] bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-accent-700">
            Projeção de sobra
          </p>
          <p className="mt-1 text-[13px] text-neutral-700">
            Mês atual + próximos {historico.length - 1}. Barras acima do
            eixo indicam sobra positiva.
          </p>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-full items-stretch gap-2 px-1">
          {historico.map((h) => {
            const saldo = h.calc.saldo;
            const alturaPct =
              maxAbs > 0 ? (Math.abs(saldo) / maxAbs) * 100 : 0;
            const positivo = saldo >= 0;
            const selecionada = h.mes.chave === selecionadaChave;
            const semDados =
              h.calc.totalRenda === 0 &&
              h.calc.totalContasRec === 0 &&
              h.calc.totalCartoes === 0 &&
              h.calc.totalDespesas === 0;

            const barraCor = semDados
              ? "bg-neutral-200"
              : positivo
                ? selecionada
                  ? "bg-sage-500"
                  : "bg-sage-400"
                : selecionada
                  ? "bg-primary"
                  : "bg-primary/70";

            return (
              <div
                key={h.mes.chave}
                className={`flex min-w-[52px] flex-1 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors ${
                  selecionada ? "bg-surface-soft" : ""
                }`}
                title={`${h.mes.label}: ${formatBRL(saldo)}`}
              >
                <span
                  className={`text-[10px] tabular-nums font-medium ${
                    semDados ? "text-neutral-400" : ""
                  }`}
                >
                  {semDados
                    ? "—"
                    : formatBRL(saldo).replace("R$ ", "").replace(",00", "")}
                </span>

                {temSaldoNegativo ? (
                  <div
                    className="relative flex w-full items-center"
                    style={{ height: alturaBarra }}
                  >
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-border/70" />
                    <div className="absolute inset-x-0 top-1/2 flex flex-col items-center">
                      {positivo ? (
                        <div className="absolute bottom-0 w-full">
                          <div
                            className={`w-full rounded-t-md ${barraCor}`}
                            style={{
                              height: `${(alturaBarra / 2) * (alturaPct / 100)}px`,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="absolute top-0 w-full">
                          <div
                            className={`w-full rounded-b-md ${barraCor}`}
                            style={{
                              height: `${(alturaBarra / 2) * (alturaPct / 100)}px`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex w-full items-end overflow-hidden rounded-md bg-muted/50"
                    style={{ height: alturaBarra }}
                  >
                    <div
                      className={`w-full rounded-md ${barraCor}`}
                      style={{ height: `${Math.max(2, alturaPct)}%` }}
                    />
                  </div>
                )}

                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className={`text-[10px] uppercase tracking-wide ${
                      selecionada
                        ? "font-heading text-accent-700"
                        : "text-neutral-700"
                    }`}
                  >
                    {MESES_ABREV[h.mes.mes - 1]}
                  </span>
                  <span className="text-[9px] text-neutral-500">
                    {String(h.mes.ano).slice(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuinzenaSaldoCard({
  dados,
  ehAtual,
}: {
  dados: CalcQuinzena;
  ehAtual: boolean;
}) {
  const meta = QUINZENA_META[dados.quinzena];
  const totalGastos =
    dados.totalContasRec + dados.totalCartoes + dados.totalDespesas;
  const pctGasto = dados.totalRenda > 0
    ? Math.min(100, (totalGastos / dados.totalRenda) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 rounded-[26px] bg-surface-soft p-6">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-neutral-700">
            Sobra quinzena · {meta.label}
          </p>
          <p className="text-[13px] text-neutral-700">{meta.subtitle}</p>
        </div>
        {ehAtual && (
          <Badge variant="secondary" className="text-[10px]">
            atual
          </Badge>
        )}
      </div>

      <p
        className={`font-heading tabular-nums ${dados.saldo >= 0 ? "text-foreground" : "text-primary"}`}
        style={{
          fontSize: "clamp(1.875rem, 4.5vw, 2.5rem)",
          lineHeight: 1,
        }}
      >
        {formatBRL(dados.saldo)}
      </p>

      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className={meta.barra} style={{ width: `${pctGasto}%` }} />
      </div>

      <div className="flex flex-col gap-2 text-[13px]">
        <ResumoLinha label="Entradas" valor={dados.totalRenda} />
        <ResumoLinha
          label="Contas"
          valor={-dados.totalContasRec}
          variant="danger"
        />
        <ResumoLinha
          label="Cartões"
          valor={-dados.totalCartoes}
          variant="danger"
        />
        <ResumoLinha
          label="Despesas"
          valor={-dados.totalDespesas}
          variant="danger"
        />
      </div>
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
  const total = contas.length + faturas.length;
  const pagas = contas.filter((c) => pagamentos.has(c.id)).length;
  const semItens = total === 0;

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="font-heading text-[22px]">Contas da quinzena</h3>
        {!semItens && (
          <span className="text-[13px] text-neutral-700">
            {pagas} de {total}{" "}
            {total === 1
              ? "paga"
              : contas.length + faturas.length > pagas + 1
                ? "pagas"
                : "paga"}
          </span>
        )}
      </div>
      {semItens ? (
        <div className="rounded-[26px] bg-card px-6 py-8 text-center text-sm text-muted-foreground">
          Nada cadastrado para o dia {quinzena}.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {faturas.map((f) => (
            <div
              key={f.cartaoId}
              className="flex items-center gap-4 rounded-[26px] bg-card px-5 py-4"
            >
              <BancoIcone
                icone={f.bancoIcone}
                corFallback={f.bancoCor}
                nomeFallback={f.bancoNome}
                size={38}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  Fatura {f.label}
                </p>
                <p className="text-[13px] text-neutral-700">Cartão</p>
              </div>
              <span className="tabular-nums text-[15px] font-medium">
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
            </div>
          ))}
          {contas.map((c) => {
            const pago = pagamentos.get(c.id);
            const atrasada =
              noMesAtual &&
              !pago &&
              c.dia_vencimento != null &&
              hojeDia > c.dia_vencimento;
            return (
              <div
                key={c.id}
                className={`flex items-center gap-4 rounded-[26px] px-5 py-4 ${
                  atrasada
                    ? "border border-accent-300 bg-accent-100"
                    : "bg-card"
                }`}
              >
                <div
                  className={`flex size-[38px] shrink-0 items-center justify-center rounded-full ${
                    pago
                      ? "bg-sage-300 text-sage-800"
                      : atrasada
                        ? "bg-accent-200 text-accent-800"
                        : "bg-neutral-200 text-foreground"
                  }`}
                >
                  {pago ? (
                    <CheckIcon className="size-[18px]" strokeWidth={2.75} />
                  ) : atrasada ? (
                    <AlertTriangleIcon
                      className="size-[18px]"
                      strokeWidth={2.75}
                    />
                  ) : (
                    <span className="font-heading text-sm">
                      {c.descricao[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[15px] font-semibold ${
                      pago ? "text-neutral-700" : ""
                    }`}
                  >
                    {c.descricao}
                  </p>
                  <p
                    className={`text-[13px] ${atrasada ? "text-accent-800" : "text-neutral-700"}`}
                  >
                    {pago
                      ? `Paga${pago.data_pagamento ? " em " + formatDataCurta(pago.data_pagamento) : ""}${c.categoria ? " · " + c.categoria : ""}`
                      : c.dia_vencimento
                        ? atrasada
                          ? `Venceu dia ${c.dia_vencimento}${c.categoria ? " · " + c.categoria : ""}`
                          : `Vence dia ${c.dia_vencimento}${c.categoria ? " · " + c.categoria : ""}`
                        : (c.categoria ?? "")}
                  </p>
                </div>
                <span
                  className={`tabular-nums text-[15px] font-medium ${
                    pago ? "text-neutral-700 line-through" : ""
                  }`}
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function UltimasDespesasCard({ despesas }: { despesas: LancamentoRow[] }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="font-heading text-[22px]">Últimas despesas</h3>
        <Link
          href="/despesas"
          className="text-[13px] text-primary hover:underline"
        >
          ver todas
        </Link>
      </div>
      {despesas.length === 0 ? (
        <div className="rounded-[26px] bg-surface-soft px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhuma despesa lançada neste mês.
        </div>
      ) : (
        <div className="rounded-[26px] bg-surface-soft px-6">
          <ul className="flex flex-col divide-y divide-border/60">
            {despesas.map((d) => (
              <li key={d.id} className="flex items-center gap-3.5 py-3.5">
                <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-card font-heading text-xs text-neutral-800">
                  {d.descricao[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {d.descricao}
                  </p>
                  <p className="text-[13px] text-neutral-700">
                    {d.data_pagamento
                      ? formatDataCurta(d.data_pagamento)
                      : ""}
                    {d.categoria ? ` · ${d.categoria}` : ""}
                  </p>
                </div>
                <span className="tabular-nums text-[15px] font-medium">
                  {formatBRL(d.valor)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function formatDataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const DIAS_PT = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function saudacaoContexto(hojeDia: number): string {
  const agora = new Date(hojeISO() + "T12:00:00"); // noon to avoid DST edge cases
  const dia = DIAS_PT[agora.getDay()];
  const mes = MESES_PT[agora.getMonth()];
  const nDia = agora.getDate();
  let momento: string;
  if (hojeDia <= 5) momento = "começo da quinzena do adiantamento";
  else if (hojeDia <= 15) momento = "meio da quinzena do adiantamento";
  else if (hojeDia <= 20) momento = "começo da quinzena do salário";
  else momento = "reta final da quinzena do salário";
  return `${dia}, ${nDia} de ${mes} — ${momento}.`;
}

