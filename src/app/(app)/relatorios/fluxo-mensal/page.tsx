import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { mesAtual, mesAnterior, type MesRef } from "@/lib/mes";
import { parcelaNoMes, assinaturaAtivaNoMes } from "@/lib/cartao-calc";

type LancamentoRow = {
  id: string;
  tipo: string;
  valor: number | string;
  data_referencia: string;
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
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number | null;
};

type AssinaturaRow = {
  id: string;
  cartao_id: string;
  valor_mensal: number | string;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
};

type CartaoRow = {
  id: string;
  dia_fechamento: number;
};

type MesTotal = {
  mes: MesRef;
  total: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function labelCurto(mes: MesRef): string {
  const [nome, ano] = mes.label.split(" ");
  return `${nome.slice(0, 3)}/${ano.slice(2)}`;
}

export default async function RelatorioFluxoMensalPage({
  searchParams,
}: PageProps<"/relatorios/fluxo-mensal">) {
  await searchParams;

  const supabase = await createClient();

  // Últimos 12 meses (mês atual + 11 anteriores), do mais antigo ao mais
  // recente.
  const meses: MesRef[] = [mesAtual()];
  for (let i = 0; i < 11; i++) {
    meses.push(mesAnterior(meses[meses.length - 1]));
  }
  meses.reverse();
  const maisAntigo = meses[0];
  const maisRecente = meses[meses.length - 1];

  // Cutoff pra compras_cartao: uma compra feita há mais de 60 meses (máximo
  // de parcelas) antes do mês mais antigo da janela não pode ter parcela
  // ativa em nenhum mês da janela.
  const cutoffDate = new Date(maisAntigo.ano, maisAntigo.mes - 1 - 60, 1);
  const comprasCutoff = `${cutoffDate.getFullYear()}-${pad2(cutoffDate.getMonth() + 1)}-01`;

  const [, lancRes, contasRes, comprasRes, assinRes, cartoesRes] =
    await Promise.all([
      requireSession(),
      supabase
        .from("lancamentos")
        .select("id, tipo, valor, data_referencia, conta_recorrente_id")
        .in("tipo", ["despesa_avulsa", "conta_fixa"])
        .gte("data_referencia", maisAntigo.primeiroDia)
        .lte("data_referencia", maisRecente.ultimoDia),
      supabase
        .from("contas_recorrentes")
        .select("id, valor_previsto, inicio_vigencia, fim_vigencia")
        .eq("ativa", true),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, valor_total, data_compra, parcelas, parcelas_ja_pagas",
        )
        .gte("data_compra", comprasCutoff)
        .lte("data_compra", maisRecente.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, valor_mensal, inicio_vigencia, fim_vigencia, ativa",
        )
        .eq("ativa", true),
      supabase.from("cartoes").select("id, dia_fechamento"),
    ]);

  const lancamentos = (lancRes.data ?? []) as LancamentoRow[];
  const contas = (contasRes.data ?? []) as RecorrenteRow[];
  const compras = (comprasRes.data ?? []) as CompraRow[];
  const assinaturas = (assinRes.data ?? []) as AssinaturaRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];

  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));

  // Despesas avulsas somadas por chave YYYY-MM.
  const despesaAvulsaPorChave = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.tipo !== "despesa_avulsa") continue;
    const chave = l.data_referencia.slice(0, 7);
    despesaAvulsaPorChave.set(
      chave,
      (despesaAvulsaPorChave.get(chave) ?? 0) + Number(l.valor),
    );
  }

  // Lançamentos de conta fixa (paga) indexados por chave|conta_recorrente_id.
  const pagoPorContaMes = new Map<string, LancamentoRow>();
  for (const l of lancamentos) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      const chave = l.data_referencia.slice(0, 7);
      pagoPorContaMes.set(`${chave}|${l.conta_recorrente_id}`, l);
    }
  }

  const totaisPorMes: MesTotal[] = meses.map((mes) => {
    let total = despesaAvulsaPorChave.get(mes.chave) ?? 0;

    for (const c of contas) {
      // Só entra se a conta estava vigente nesse mês (mesma regra usada
      // pela query de gastos-por-categoria, aqui replicada em memória
      // porque `contas` cobre a janela inteira de 12 meses de uma vez).
      const vigente =
        c.inicio_vigencia <= mes.ultimoDia &&
        (c.fim_vigencia === null || c.fim_vigencia >= mes.primeiroDia);
      if (!vigente) continue;
      const pago = pagoPorContaMes.get(`${mes.chave}|${c.id}`);
      total += pago ? Number(pago.valor) : Number(c.valor_previsto);
    }

    for (const compra of compras) {
      const cartao = cartaoById.get(compra.cartao_id);
      const diaFechamento = cartao?.dia_fechamento ?? 1;
      const info = parcelaNoMes(
        {
          id: compra.id,
          cartao_id: compra.cartao_id,
          descricao: "",
          valor_total: compra.valor_total,
          data_compra: compra.data_compra,
          parcelas: compra.parcelas,
          parcelas_ja_pagas: compra.parcelas_ja_pagas ?? undefined,
          categoria: null,
        },
        diaFechamento,
        mes,
      );
      if (!info) continue;
      total += info.valor;
    }

    for (const a of assinaturas) {
      const ativa = assinaturaAtivaNoMes(
        {
          id: a.id,
          cartao_id: a.cartao_id,
          descricao: "",
          valor_mensal: a.valor_mensal,
          categoria: null,
          inicio_vigencia: a.inicio_vigencia,
          fim_vigencia: a.fim_vigencia,
          ativa: a.ativa,
        },
        mes,
      );
      if (!ativa) continue;
      total += Number(a.valor_mensal);
    }

    return { mes, total: Number(total.toFixed(2)) };
  });

  const semDados =
    lancamentos.length === 0 &&
    contas.length === 0 &&
    compras.length === 0 &&
    assinaturas.length === 0;

  const totalPeriodo = totaisPorMes.reduce((s, m) => s + m.total, 0);
  const mediaMensal = totaisPorMes.length > 0 ? totalPeriodo / totaisPorMes.length : 0;
  const maximoGrafico = totaisPorMes.reduce((mx, m) => Math.max(mx, m.total), 0);

  let maiorMes = totaisPorMes[0];
  let menorMes = totaisPorMes[0];
  for (const m of totaisPorMes) {
    if (m.total > maiorMes.total) maiorMes = m;
    if (m.total < menorMes.total) menorMes = m;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:gap-7 md:p-8">
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
            Fluxo mensal
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Total gasto (despesas avulsas, contas fixas, compras no cartão e
            assinaturas) em cada um dos últimos 12 meses, de{" "}
            {maisAntigo.label} a {maisRecente.label}.
          </p>
        </div>
      </header>

      {semDados ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum gasto registrado nos últimos 12 meses.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <ResumoCard label="Total do período" valor={formatBRL(totalPeriodo)} />
            <ResumoCard label="Média mensal" valor={formatBRL(mediaMensal)} />
            <ResumoCard
              label="Mês de maior gasto"
              valor={formatBRL(maiorMes.total)}
              hint={maiorMes.mes.label}
              destaque
            />
            <ResumoCard
              label="Mês de menor gasto"
              valor={formatBRL(menorMes.total)}
              hint={menorMes.mes.label}
            />
          </div>

          <FluxoChart dados={totaisPorMes} maximo={maximoGrafico} />

          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Mês</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Variação vs mês anterior
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {totaisPorMes.map((m, i) => {
                    const anterior = i > 0 ? totaisPorMes[i - 1] : null;
                    const { texto, cor } = formatDelta(m.total, anterior);
                    return (
                      <tr key={m.mes.chave} className="hover:bg-muted/30">
                        <td className="px-4 py-3">{m.mes.label}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {formatBRL(m.total)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${cor}`}
                        >
                          {texto}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col divide-y divide-border/60 md:hidden">
              {totaisPorMes.map((m, i) => {
                const anterior = i > 0 ? totaisPorMes[i - 1] : null;
                const { texto, cor } = formatDelta(m.total, anterior);
                return (
                  <li
                    key={m.mes.chave}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <span className="font-medium">{m.mes.label}</span>
                    <div className="flex flex-col items-end">
                      <span className="tabular-nums font-medium">
                        {formatBRL(m.total)}
                      </span>
                      <span className={`text-xs tabular-nums ${cor}`}>
                        {texto}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function formatDelta(
  total: number,
  anterior: MesTotal | null,
): { texto: string; cor: string } {
  if (!anterior) return { texto: "—", cor: "text-muted-foreground" };
  if (anterior.total === 0) {
    return total > 0
      ? { texto: "novo", cor: "text-primary" }
      : { texto: "—", cor: "text-muted-foreground" };
  }
  const deltaPct = ((total - anterior.total) / anterior.total) * 100;
  if (deltaPct === 0) return { texto: "—", cor: "text-muted-foreground" };
  const cor = deltaPct <= 0 ? "text-sage-700" : "text-primary";
  const texto = `${deltaPct > 0 ? "+" : "−"}${Math.abs(deltaPct).toFixed(0)}%`;
  return { texto, cor };
}

function FluxoChart({
  dados,
  maximo,
}: {
  dados: MesTotal[];
  maximo: number;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Gasto total por mês
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Soma das quatro fontes de gasto em cada mês, do mais antigo ao
            mais recente — dá pra ver se o gasto está subindo ou caindo.
          </p>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-full items-end gap-2 px-1">
            {dados.map((d) => {
              const alturaPct = maximo > 0 ? (d.total / maximo) * 100 : 0;
              return (
                <div
                  key={d.mes.chave}
                  className="flex min-w-[64px] flex-1 flex-col items-center gap-1.5"
                  title={`${d.mes.label} — ${formatBRL(d.total)}`}
                >
                  <span className="text-[10px] tabular-nums font-medium">
                    {formatBRL(d.total).replace("R$ ", "")}
                  </span>
                  <div className="relative flex h-32 w-full items-end overflow-hidden rounded-md bg-muted/60">
                    <div
                      className="w-full rounded-md bg-primary"
                      style={{ height: `${Math.max(2, alturaPct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {labelCurto(d.mes)}
                  </span>
                </div>
              );
            })}
          </div>
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
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", lineHeight: 1 }}
        >
          {valor}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
