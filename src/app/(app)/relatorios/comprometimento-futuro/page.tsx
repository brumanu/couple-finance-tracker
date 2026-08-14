import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { mesAtual, mesProximo, type MesRef } from "@/lib/mes";
import {
  parcelaNoMes,
  assinaturaAtivaNoMes,
  type CompraCartaoInfo,
  type AssinaturaCartaoInfo,
} from "@/lib/cartao-calc";

type CompraRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number | null;
  categoria: string | null;
  categoria_id: string | null;
};

type AssinaturaRow = {
  id: string;
  cartao_id: string;
  valor_mensal: number | string;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
};

type ContaRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  ativa: boolean;
  inicio_vigencia: string;
  fim_vigencia: string | null;
};

type CartaoRow = {
  id: string;
  dia_fechamento: number;
};

type DividaRow = {
  id: string;
  descricao: string;
  valor_total: number | string;
};

type PagamentoRow = {
  divida_id: string;
  valor: number | string;
};

type MesComprometimento = {
  chave: string;
  label: string;
  labelAbrev: string;
  comprasTotal: number;
  assinaturasTotal: number;
  contasTotal: number;
  total: number;
};

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function labelMesAbrev(ano: number, mes: number): string {
  return `${MESES_ABREV[mes - 1]}/${String(ano).slice(2)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export default async function RelatorioComprometimentoFuturoPage({
  searchParams,
}: PageProps<"/relatorios/comprometimento-futuro">) {
  // Este relatório não usa filtros por querystring — janela sempre fixa
  // (mês atual + próximos 11 meses) — mas mantemos a assinatura padrão.
  await searchParams;

  const supabase = await createClient();

  const meses: MesRef[] = [mesAtual()];
  for (let i = 1; i < 12; i++) {
    meses.push(mesProximo(meses[i - 1]));
  }
  const mesFinal = meses[meses.length - 1];
  const mesInicial = meses[0];

  // Cutoff generoso: uma compra feita há mais de 60 meses (máximo de
  // parcelas) antes do início da janela não pode ter parcela ativa nela.
  const cutoffDate = new Date(mesInicial.ano, mesInicial.mes - 1 - 60, 1);
  const comprasCutoff = `${cutoffDate.getFullYear()}-${pad2(cutoffDate.getMonth() + 1)}-01`;

  const [, comprasRes, assinRes, contasRes, cartoesRes, dividasRes, pagRes] =
    await Promise.all([
      requireSession(),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria, categoria_id",
        )
        .gte("data_compra", comprasCutoff)
        .lte("data_compra", mesFinal.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, valor_mensal, inicio_vigencia, fim_vigencia, ativa",
        )
        .eq("ativa", true),
      supabase
        .from("contas_recorrentes")
        .select(
          "id, descricao, valor_previsto, ativa, inicio_vigencia, fim_vigencia",
        )
        .eq("ativa", true),
      supabase.from("cartoes").select("id, dia_fechamento"),
      supabase
        .from("dividas")
        .select("id, descricao, valor_total")
        .order("created_at", { ascending: false }),
      supabase.from("pagamentos_divida").select("divida_id, valor"),
    ]);

  const compras = (comprasRes.data ?? []) as CompraRow[];
  const assinaturas = (assinRes.data ?? []) as AssinaturaRow[];
  const contas = (contasRes.data ?? []) as ContaRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
  const dividas = (dividasRes.data ?? []) as DividaRow[];
  const pagamentos = (pagRes.data ?? []) as PagamentoRow[];

  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));

  let mesMaisDistanteChave: string | null = null;
  let mesMaisDistanteLabel: string | null = null;

  const mesesComprometimento: MesComprometimento[] = meses.map((mes) => {
    let comprasTotal = 0;

    for (const compra of compras) {
      const cartao = cartaoById.get(compra.cartao_id);
      const diaFechamento = cartao?.dia_fechamento ?? 1;
      const compraInfo: CompraCartaoInfo = {
        id: compra.id,
        cartao_id: compra.cartao_id,
        descricao: compra.descricao,
        valor_total: compra.valor_total,
        data_compra: compra.data_compra,
        parcelas: compra.parcelas,
        parcelas_ja_pagas: compra.parcelas_ja_pagas ?? undefined,
        categoria: compra.categoria,
      };
      const info = parcelaNoMes(compraInfo, diaFechamento, mes);
      if (!info) continue;

      comprasTotal += info.valor;

      // A "última parcela" independe do mês consultado — sempre que a
      // compra tem parcela ativa em algum mês da janela, aproveitamos
      // pra achar o mês mais distante com parcela em aberto (pode ser
      // além dos 12 meses do relatório).
      if (
        mesMaisDistanteChave === null ||
        info.ultimaParcela.chave > mesMaisDistanteChave
      ) {
        mesMaisDistanteChave = info.ultimaParcela.chave;
        mesMaisDistanteLabel = info.ultimaParcela.label;
      }
    }

    let assinaturasTotal = 0;
    for (const a of assinaturas) {
      const assinaturaInfo: AssinaturaCartaoInfo = {
        id: a.id,
        cartao_id: a.cartao_id,
        descricao: "",
        valor_mensal: a.valor_mensal,
        categoria: null,
        inicio_vigencia: a.inicio_vigencia,
        fim_vigencia: a.fim_vigencia,
        ativa: a.ativa,
      };
      if (assinaturaAtivaNoMes(assinaturaInfo, mes)) {
        assinaturasTotal += Number(a.valor_mensal);
      }
    }

    // Contas fixas: mesmo valor todo mês, mas só enquanto vigente nesse mês
    // (contas_recorrentes tem inicio_vigencia/fim_vigencia, igual às
    // assinaturas — não é só "ativa=true pra sempre").
    let contasTotal = 0;
    for (const c of contas) {
      const vigente =
        c.inicio_vigencia <= mes.ultimoDia &&
        (c.fim_vigencia === null || c.fim_vigencia >= mes.primeiroDia);
      if (!vigente) continue;
      contasTotal += Number(c.valor_previsto);
    }

    const total = comprasTotal + assinaturasTotal + contasTotal;

    return {
      chave: mes.chave,
      label: mes.label,
      labelAbrev: labelMesAbrev(mes.ano, mes.mes),
      comprasTotal: Number(comprasTotal.toFixed(2)),
      assinaturasTotal: Number(assinaturasTotal.toFixed(2)),
      contasTotal: Number(contasTotal.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  });

  // Dívidas: soma do "falta pagar" de cada uma — mesmo cálculo da página
  // /dividas. Não entra mês a mês, é um valor único à parte.
  const pagoPorDivida = new Map<string, number>();
  for (const p of pagamentos) {
    pagoPorDivida.set(
      p.divida_id,
      (pagoPorDivida.get(p.divida_id) ?? 0) + Number(p.valor),
    );
  }
  const dividasTotal = dividas.reduce((s, d) => {
    const pago = pagoPorDivida.get(d.id) ?? 0;
    const total = Number(d.valor_total);
    const restante = Math.max(0, total - pago);
    return s + restante;
  }, 0);

  const proximoMesTotal = mesesComprometimento[1]?.total ?? 0;
  const total12Meses = Number(
    mesesComprometimento.reduce((s, m) => s + m.total, 0).toFixed(2),
  );
  const valorMaximoBarra = mesesComprometimento.reduce(
    (m, b) => Math.max(m, b.total),
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
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

      <header>
        <h2 className="font-heading text-3xl leading-tight md:text-4xl">
          Comprometimento futuro
        </h2>
        <p className="mt-1 max-w-[64ch] text-sm text-muted-foreground">
          Quanto do orçamento dos próximos 12 meses já está travado por
          parcelas de compras no cartão, assinaturas ativas e contas fixas —
          de {mesInicial.label} a {mesFinal.label}.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <ResumoCard
          label="Comprometido no próximo mês"
          valor={formatBRL(proximoMesTotal)}
          hint={mesesComprometimento[1]?.label}
          destaque
        />
        <ResumoCard
          label="Comprometido nos próximos 12 meses"
          valor={formatBRL(total12Meses)}
          hint={`${mesInicial.label} a ${mesFinal.label}`}
        />
        <ResumoCard
          label="Parcela em aberto mais distante"
          valor={mesMaisDistanteLabel ?? "—"}
          hint={
            mesMaisDistanteLabel
              ? "mês em que a última parcela cai"
              : "nenhuma compra parcelada em aberto"
          }
        />
        <ResumoCard
          label="Total de dívidas em aberto"
          valor={formatBRL(dividasTotal)}
          hint="fora da soma mês a mês"
        />
      </div>

      <ComprometimentoChart
        meses={mesesComprometimento}
        maximo={valorMaximoBarra}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Mês</th>
                <th className="px-4 py-3 text-right font-medium">
                  Parcelas de compras
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Assinaturas
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Contas fixas
                </th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mesesComprometimento.map((m) => (
                <tr key={m.chave} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{m.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatBRL(m.comprasTotal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatBRL(m.assinaturasTotal)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatBRL(m.contasTotal)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-primary">
                    {formatBRL(m.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/60 bg-muted/40">
                <td className="px-4 py-3 font-medium">12 meses</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatBRL(
                    mesesComprometimento.reduce(
                      (s, m) => s + m.comprasTotal,
                      0,
                    ),
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatBRL(
                    mesesComprometimento.reduce(
                      (s, m) => s + m.assinaturasTotal,
                      0,
                    ),
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatBRL(
                    mesesComprometimento.reduce(
                      (s, m) => s + m.contasTotal,
                      0,
                    ),
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-primary">
                  {formatBRL(total12Meses)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ComprometimentoChart({
  meses,
  maximo,
}: {
  meses: MesComprometimento[];
  maximo: number;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Comprometido mês a mês
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Soma de parcelas de compras no cartão, assinaturas ativas e
            contas fixas previstas pra cada um dos próximos 12 meses. Passe o
            mouse numa barra pra ver o detalhamento.
          </p>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-full items-end gap-2 px-1">
            {meses.map((m) => {
              const alturaPct = maximo > 0 ? (m.total / maximo) * 100 : 0;
              return (
                <div
                  key={m.chave}
                  className="flex min-w-[68px] flex-1 flex-col items-center gap-1.5"
                  title={`${m.label} — total ${formatBRL(m.total)} (parcelas ${formatBRL(
                    m.comprasTotal,
                  )} · assinaturas ${formatBRL(
                    m.assinaturasTotal,
                  )} · contas fixas ${formatBRL(m.contasTotal)})`}
                >
                  <span className="text-[10px] font-medium tabular-nums">
                    {formatBRL(m.total).replace("R$ ", "")}
                  </span>
                  <div className="relative flex h-32 w-full items-end overflow-hidden rounded-md bg-muted/60">
                    <div
                      className="w-full rounded-md bg-primary"
                      style={{ height: `${Math.max(2, alturaPct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {m.labelAbrev}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-primary" />
            total comprometido no mês (parcelas + assinaturas + contas fixas)
          </span>
        </div>
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
          className={`font-heading tabular-nums ${
            destaque ? "text-primary" : ""
          }`}
          style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)", lineHeight: 1.1 }}
        >
          {valor}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
