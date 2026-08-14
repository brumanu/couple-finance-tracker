import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseMesParam, mesAnterior, type MesRef } from "@/lib/mes";
import { parcelaNoMes, assinaturaAtivaNoMes } from "@/lib/cartao-calc";
import { formatBRL } from "@/lib/format";
import { MonthSwitcher } from "../../month-switcher";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type LancamentoRow = {
  id: string;
  tipo: string;
  valor: number | string;
  data_referencia: string;
  data_pagamento: string | null;
  conta_recorrente_id: string | null;
};

type RecorrenteRow = {
  id: string;
  valor_previsto: number | string;
  inicio_vigencia: string;
  fim_vigencia: string | null;
};

type CompraRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number | null;
};

type AssinaturaRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
};

type CartaoRow = {
  id: string;
  dia_fechamento: number;
};

type RendaRow = {
  valor_previsto: number | string;
};

type DespesaBreakdown = {
  avulsas: number;
  contasFixas: number;
  cartao: number;
  assinaturas: number;
  total: number;
};

type RendaBreakdown = {
  fixa: number;
  extra: number;
  total: number;
};

// RENDA do mês = rendas fixas ativas (valor integral, sempre) + renda
// extra (lançamentos tipo="renda_extra" lançados dentro do mês).
function computeRenda(
  mesRef: MesRef,
  rendas: RendaRow[],
  lancamentos: LancamentoRow[],
): RendaBreakdown {
  const fixa = rendas.reduce((s, r) => s + Number(r.valor_previsto), 0);
  const extra = lancamentos
    .filter(
      (l) =>
        l.tipo === "renda_extra" &&
        l.data_referencia >= mesRef.primeiroDia &&
        l.data_referencia <= mesRef.ultimoDia,
    )
    .reduce((s, l) => s + Number(l.valor), 0);
  return {
    fixa: Number(fixa.toFixed(2)),
    extra: Number(extra.toFixed(2)),
    total: Number((fixa + extra).toFixed(2)),
  };
}

// DESPESA do mês = mesma agregação de 4 fontes usada em
// relatorios/gastos-por-categoria: despesas avulsas lançadas no mês, contas
// fixas vigentes (paga ou prevista), parcela ativa de compras no cartão e
// assinaturas ativas no mês.
function computeDespesa(
  mesRef: MesRef,
  lancamentos: LancamentoRow[],
  contas: RecorrenteRow[],
  compras: CompraRow[],
  assinaturas: AssinaturaRow[],
  cartaoById: Map<string, CartaoRow>,
): DespesaBreakdown {
  const lancsMes = lancamentos.filter(
    (l) =>
      l.data_referencia >= mesRef.primeiroDia &&
      l.data_referencia <= mesRef.ultimoDia,
  );

  const avulsas = lancsMes
    .filter((l) => l.tipo === "despesa_avulsa")
    .reduce((s, l) => s + Number(l.valor), 0);

  const pagosMes = new Map<string, LancamentoRow>();
  for (const l of lancsMes) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagosMes.set(l.conta_recorrente_id, l);
    }
  }
  let contasFixas = 0;
  for (const c of contas) {
    const vigente =
      c.inicio_vigencia <= mesRef.ultimoDia &&
      (c.fim_vigencia === null || c.fim_vigencia >= mesRef.primeiroDia);
    if (!vigente) continue;
    const pago = pagosMes.get(c.id);
    contasFixas += pago ? Number(pago.valor) : Number(c.valor_previsto);
  }

  let cartao = 0;
  for (const compra of compras) {
    const cartaoInfo = cartaoById.get(compra.cartao_id);
    const diaFechamento = cartaoInfo?.dia_fechamento ?? 1;
    const info = parcelaNoMes(
      {
        id: compra.id,
        cartao_id: compra.cartao_id,
        descricao: compra.descricao,
        valor_total: compra.valor_total,
        data_compra: compra.data_compra,
        parcelas: compra.parcelas,
        parcelas_ja_pagas: compra.parcelas_ja_pagas ?? undefined,
        categoria: null,
      },
      diaFechamento,
      mesRef,
    );
    if (info) cartao += info.valor;
  }

  let assin = 0;
  for (const a of assinaturas) {
    const ativa = assinaturaAtivaNoMes(
      {
        id: a.id,
        cartao_id: a.cartao_id,
        descricao: a.descricao,
        valor_mensal: a.valor_mensal,
        categoria: null,
        inicio_vigencia: a.inicio_vigencia,
        fim_vigencia: a.fim_vigencia,
        ativa: a.ativa,
      },
      mesRef,
    );
    if (ativa) assin += Number(a.valor_mensal);
  }

  return {
    avulsas: Number(avulsas.toFixed(2)),
    contasFixas: Number(contasFixas.toFixed(2)),
    cartao: Number(cartao.toFixed(2)),
    assinaturas: Number(assin.toFixed(2)),
    total: Number((avulsas + contasFixas + cartao + assin).toFixed(2)),
  };
}

function calcDeltaPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export default async function RelatorioRendaXDespesaPage({
  searchParams,
}: PageProps<"/relatorios/renda-x-despesa">) {
  const supabase = await createClient();

  const sp = await searchParams;
  const mesParam = typeof sp.mes === "string" ? sp.mes : undefined;
  const mes = parseMesParam(mesParam);
  const anterior = mesAnterior(mes);

  // Cutoff pra compras_cartao: uma compra feita há mais de 60 meses (máximo
  // de parcelas) antes do mês mais antigo exibido não pode ter parcela
  // ativa em nenhum dos dois meses.
  const cutoffDate = new Date(anterior.ano, anterior.mes - 1 - 60, 1);
  const comprasCutoff = `${cutoffDate.getFullYear()}-${pad2(cutoffDate.getMonth() + 1)}-01`;

  const [, lancRes, contasRes, comprasRes, assinRes, cartoesRes, rendasRes] =
    await Promise.all([
      requireSession(),
      supabase
        .from("lancamentos")
        .select(
          "id, tipo, valor, data_referencia, data_pagamento, conta_recorrente_id",
        )
        .in("tipo", ["despesa_avulsa", "conta_fixa", "renda_extra"])
        .gte("data_referencia", anterior.primeiroDia)
        .lte("data_referencia", mes.ultimoDia),
      supabase
        .from("contas_recorrentes")
        .select("id, valor_previsto, inicio_vigencia, fim_vigencia")
        .eq("ativa", true)
        .lte("inicio_vigencia", mes.ultimoDia)
        .or(`fim_vigencia.is.null,fim_vigencia.gte.${anterior.primeiroDia}`),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas",
        )
        .gte("data_compra", comprasCutoff)
        .lte("data_compra", mes.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, descricao, valor_mensal, inicio_vigencia, fim_vigencia, ativa",
        )
        .eq("ativa", true),
      supabase.from("cartoes").select("id, dia_fechamento"),
      supabase.from("rendas").select("valor_previsto").eq("ativa", true),
    ]);

  const lancamentos = (lancRes.data ?? []) as LancamentoRow[];
  const contas = (contasRes.data ?? []) as RecorrenteRow[];
  const compras = (comprasRes.data ?? []) as CompraRow[];
  const assinaturas = (assinRes.data ?? []) as AssinaturaRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
  const rendas = (rendasRes.data ?? []) as RendaRow[];

  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));

  const rendaAtual = computeRenda(mes, rendas, lancamentos);
  const rendaAnterior = computeRenda(anterior, rendas, lancamentos);
  const despesaAtual = computeDespesa(
    mes,
    lancamentos,
    contas,
    compras,
    assinaturas,
    cartaoById,
  );
  const despesaAnterior = computeDespesa(
    anterior,
    lancamentos,
    contas,
    compras,
    assinaturas,
    cartaoById,
  );

  const saldo = Number((rendaAtual.total - despesaAtual.total).toFixed(2));

  const deltaRenda = calcDeltaPct(rendaAtual.total, rendaAnterior.total);
  const deltaDespesa = calcDeltaPct(despesaAtual.total, despesaAnterior.total);

  const maiorBarra = Math.max(rendaAtual.total, despesaAtual.total);

  const buckets = [
    { label: "Despesas avulsas", valor: despesaAtual.avulsas },
    { label: "Contas fixas", valor: despesaAtual.contasFixas },
    { label: "Compras no cartão", valor: despesaAtual.cartao },
    { label: "Assinaturas", valor: despesaAtual.assinaturas },
  ];
  const maiorBucket = buckets.reduce((m, b) => Math.max(m, b.valor), 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/relatorios">
              <ArrowLeftIcon className="size-4" strokeWidth={2.75} />
              Voltar
            </Link>
          }
        />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Renda x despesa
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Quanto entrou e quanto saiu em {mes.label}, e se sobrou ou faltou
            no fim do mês.
          </p>
        </div>
        <MonthSwitcher mes={mes} />
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumoCard
          label="Renda do mês"
          valor={formatBRL(rendaAtual.total)}
          atual={rendaAtual.total}
          delta={deltaRenda}
          melhoraSeAumenta
        />
        <ResumoCard
          label="Despesa do mês"
          valor={formatBRL(despesaAtual.total)}
          atual={despesaAtual.total}
          delta={deltaDespesa}
          melhoraSeAumenta={false}
        />
        <ResumoCard
          label="Saldo do mês"
          valor={formatBRL(saldo)}
          destaqueCor={saldo >= 0 ? "text-sage-700" : "text-primary"}
        />
      </div>

      <ComparativoChart
        mesLabel={mes.label}
        renda={rendaAtual.total}
        despesa={despesaAtual.total}
        maximo={maiorBarra}
      />

      <Card>
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-primary">
              Despesa por origem
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Como a despesa de {mes.label} se distribui entre avulsas,
              contas fixas, compras no cartão e assinaturas.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {buckets.map((b) => {
              const pct = maiorBucket > 0 ? (b.valor / maiorBucket) * 100 : 0;
              return (
                <li key={b.label} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{b.label}</span>
                    <span className="whitespace-nowrap tabular-nums text-sm font-medium">
                      {formatBRL(b.valor)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${b.valor > 0 ? Math.max(2, pct) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>
    </div>
  );
}

function ComparativoChart({
  mesLabel,
  renda,
  despesa,
  maximo,
}: {
  mesLabel: string;
  renda: number;
  despesa: number;
  maximo: number;
}) {
  const alturaRenda = maximo > 0 ? (renda / maximo) * 100 : 0;
  const alturaDespesa = maximo > 0 ? (despesa / maximo) * 100 : 0;
  const saldo = Number((renda - despesa).toFixed(2));

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Renda x despesa em {mesLabel}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparação lado a lado entre tudo que entrou e tudo que saiu no
            mês.
          </p>
        </div>

        <div className="flex items-end justify-center gap-10 px-4 pb-1 md:gap-16">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-medium tabular-nums">
              {formatBRL(renda)}
            </span>
            <div className="relative flex h-40 w-20 items-end overflow-hidden rounded-md bg-muted/60">
              <div
                className="w-full rounded-md bg-sage-500"
                style={{ height: `${Math.max(renda > 0 ? 2 : 0, alturaRenda)}%` }}
              />
            </div>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Renda
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-medium tabular-nums">
              {formatBRL(despesa)}
            </span>
            <div className="relative flex h-40 w-20 items-end overflow-hidden rounded-md bg-muted/60">
              <div
                className="w-full rounded-md bg-primary"
                style={{
                  height: `${Math.max(despesa > 0 ? 2 : 0, alturaDespesa)}%`,
                }}
              />
            </div>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Despesa
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-sage-500" />
            renda
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-primary" />
            despesa
          </span>
          <span>
            saldo{" "}
            <strong
              className={`tabular-nums ${
                saldo >= 0 ? "text-sage-700" : "text-primary"
              }`}
            >
              {formatBRL(saldo)}
            </strong>
          </span>
        </div>
      </div>
    </Card>
  );
}

function ResumoCard({
  label,
  valor,
  atual,
  delta = null,
  melhoraSeAumenta,
  destaqueCor,
}: {
  label: string;
  valor: string;
  atual?: number;
  delta?: number | null;
  melhoraSeAumenta?: boolean;
  destaqueCor?: string;
}) {
  const mostrarDelta = melhoraSeAumenta !== undefined && atual !== undefined;
  let corDelta = "text-muted-foreground";
  let textoDelta = "—";
  if (mostrarDelta) {
    const melhora =
      delta === null
        ? true
        : melhoraSeAumenta
          ? delta >= 0
          : delta <= 0;
    corDelta = melhora ? "text-sage-700" : "text-primary";
    textoDelta =
      delta === null
        ? atual! > 0
          ? "novo"
          : "—"
        : delta === 0
          ? "—"
          : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(0)}%`;
  }

  return (
    <Card>
      <div className="flex flex-col gap-2 p-5">
        <p className="text-[11px] uppercase tracking-widest text-primary">
          {label}
        </p>
        <p
          className={`font-heading tabular-nums ${destaqueCor ?? ""}`}
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", lineHeight: 1 }}
        >
          {valor}
        </p>
        {mostrarDelta && (
          <p className={`text-xs tabular-nums ${corDelta}`}>
            {textoDelta} vs. mês anterior
          </p>
        )}
      </div>
    </Card>
  );
}
