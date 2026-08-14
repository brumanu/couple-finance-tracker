import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias-server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mesAtual, mesAnterior, type MesRef } from "@/lib/mes";
import { parcelaNoMes, assinaturaAtivaNoMes } from "@/lib/cartao-calc";
import { formatBRL } from "@/lib/format";

type LancamentoRow = {
  id: string;
  tipo: string;
  valor: number | string;
  data_referencia: string;
  categoria_id: string | null;
  conta_recorrente_id: string | null;
};

type RecorrenteRow = {
  id: string;
  valor_previsto: number | string;
  categoria_id: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
};

type CompraRow = {
  id: string;
  cartao_id: string;
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number | null;
  categoria_id: string | null;
};

type AssinaturaRow = {
  id: string;
  cartao_id: string;
  valor_mensal: number | string;
  categoria_id: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
};

type CartaoRow = {
  id: string;
  dia_fechamento: number;
};

type LinhaCategoria = {
  id: string | null;
  nome: string;
  cor: string;
  emoji: string | null;
  valores: number[]; // alinhado com `meses`, cronológico
  total: number;
};

const SEM_CATEGORIA_KEY = "__sem__";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Abrevia "Agosto 2026" -> "Ago/26". */
function labelCurto(mes: MesRef): string {
  return `${mes.label.slice(0, 3)}/${String(mes.ano).slice(2)}`;
}

/**
 * Agrega os gastos do mês por categoria_id (chave "__sem__" para sem
 * categoria), repetindo a mesma regra de gastos-por-categoria: despesas
 * avulsas, contas fixas (paga via lançamento ou prevista), parcela ativa
 * de compras no cartão e assinaturas vigentes.
 */
function calcularTotaisPorCategoria(
  mes: MesRef,
  lancamentos: LancamentoRow[],
  contas: RecorrenteRow[],
  compras: CompraRow[],
  assinaturas: AssinaturaRow[],
  cartaoById: Map<string, CartaoRow>,
): Map<string, number> {
  const totais = new Map<string, number>();
  function add(categoriaId: string | null, valor: number) {
    const key = categoriaId ?? SEM_CATEGORIA_KEY;
    totais.set(key, (totais.get(key) ?? 0) + valor);
  }

  const lancamentosDoMes = lancamentos.filter(
    (l) => l.data_referencia.slice(0, 7) === mes.chave,
  );

  // Despesas avulsas do mês.
  for (const l of lancamentosDoMes) {
    if (l.tipo !== "despesa_avulsa") continue;
    add(l.categoria_id, Number(l.valor));
  }

  // Contas fixas vigentes no mês: paga (usa o lançamento) ou prevista.
  const pagosMes = new Map<string, LancamentoRow>();
  for (const l of lancamentosDoMes) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagosMes.set(l.conta_recorrente_id, l);
    }
  }
  for (const c of contas) {
    if (c.inicio_vigencia > mes.ultimoDia) continue;
    if (c.fim_vigencia !== null && c.fim_vigencia < mes.primeiroDia) continue;
    const pago = pagosMes.get(c.id);
    const categoriaId = pago ? pago.categoria_id : c.categoria_id;
    const valor = pago ? Number(pago.valor) : Number(c.valor_previsto);
    add(categoriaId, valor);
  }

  // Compras no cartão: só a parcela ativa no mês alvo, se houver.
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
    add(compra.categoria_id, info.valor);
  }

  // Assinaturas de cartão ativas no mês alvo.
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
    add(a.categoria_id, Number(a.valor_mensal));
  }

  return totais;
}

export default async function RelatorioCategoriaPorMesPage({
  searchParams,
}: PageProps<"/relatorios/categoria-por-mes">) {
  void searchParams;
  const supabase = await createClient();

  // Últimos 6 meses, do mais antigo pro mais recente.
  const meses: MesRef[] = [mesAtual()];
  for (let i = 0; i < 5; i++) meses.unshift(mesAnterior(meses[0]));
  const mesMaisAntigo = meses[0];
  const mesMaisRecente = meses[meses.length - 1];

  // Cutoff pra compras_cartao: uma compra feita há mais de 60 meses (máximo
  // de parcelas) antes do mês mais antigo da janela não pode ter parcela
  // ativa em nenhum mês da janela.
  const cutoffDate = new Date(
    mesMaisAntigo.ano,
    mesMaisAntigo.mes - 1 - 60,
    1,
  );
  const comprasCutoff = `${cutoffDate.getFullYear()}-${pad2(cutoffDate.getMonth() + 1)}-01`;

  const [, lancRes, contasRes, comprasRes, assinRes, cartoesRes, categorias] =
    await Promise.all([
      requireSession(),
      supabase
        .from("lancamentos")
        .select(
          "id, tipo, valor, data_referencia, categoria_id, conta_recorrente_id",
        )
        .in("tipo", ["despesa_avulsa", "conta_fixa"])
        .gte("data_referencia", mesMaisAntigo.primeiroDia)
        .lte("data_referencia", mesMaisRecente.ultimoDia),
      supabase
        .from("contas_recorrentes")
        .select("id, valor_previsto, categoria_id, inicio_vigencia, fim_vigencia, ativa")
        .eq("ativa", true)
        .lte("inicio_vigencia", mesMaisRecente.ultimoDia)
        .or(`fim_vigencia.is.null,fim_vigencia.gte.${mesMaisAntigo.primeiroDia}`),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria_id",
        )
        .gte("data_compra", comprasCutoff)
        .lte("data_compra", mesMaisRecente.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, valor_mensal, categoria_id, inicio_vigencia, fim_vigencia, ativa",
        )
        .eq("ativa", true),
      supabase.from("cartoes").select("id, dia_fechamento"),
      getCategorias(),
    ]);

  const lancamentos = (lancRes.data ?? []) as LancamentoRow[];
  const contas = (contasRes.data ?? []) as RecorrenteRow[];
  const compras = (comprasRes.data ?? []) as CompraRow[];
  const assinaturas = (assinRes.data ?? []) as AssinaturaRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];

  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));
  const categoriaById = new Map(categorias.map((c) => [c.id, c] as const));

  // Totais por categoria, calculados uma vez por mês (dados já em memória).
  const totaisPorMes = new Map<string, Map<string, number>>();
  for (const mes of meses) {
    totaisPorMes.set(
      mes.chave,
      calcularTotaisPorCategoria(
        mes,
        lancamentos,
        contas,
        compras,
        assinaturas,
        cartaoById,
      ),
    );
  }

  // Só categorias com algum gasto não-zero em pelo menos um mês da janela.
  const chavesComGasto = new Set<string>();
  for (const mapa of totaisPorMes.values()) {
    for (const [key, valor] of mapa) {
      if (valor > 0) chavesComGasto.add(key);
    }
  }

  const linhas: LinhaCategoria[] = Array.from(chavesComGasto)
    .map((key) => {
      const categoriaId = key === SEM_CATEGORIA_KEY ? null : key;
      const cat = categoriaId ? categoriaById.get(categoriaId) : undefined;
      const valores = meses.map(
        (m) => Number((totaisPorMes.get(m.chave)?.get(key) ?? 0).toFixed(2)),
      );
      const total = Number(valores.reduce((s, v) => s + v, 0).toFixed(2));
      return {
        id: categoriaId,
        nome: cat?.nome ?? "Sem categoria",
        cor: cat?.cor ?? "#a3a3a3",
        emoji: cat?.emoji ?? null,
        valores,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);

  const totalPorMes = meses.map((_, i) =>
    Number(linhas.reduce((s, l) => s + l.valores[i], 0).toFixed(2)),
  );
  const totalGeral = Number(
    totalPorMes.reduce((s, v) => s + v, 0).toFixed(2),
  );

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

      <header>
        <h2 className="font-heading text-3xl leading-tight md:text-4xl">
          Categoria mês a mês
        </h2>
        <p className="mt-1 max-w-[64ch] text-sm text-muted-foreground">
          Como o gasto de cada categoria evoluiu de {mesMaisAntigo.label} a{" "}
          {mesMaisRecente.label}.
        </p>
      </header>

      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum gasto registrado nos últimos 6 meses.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/60 px-4 py-3 text-left font-medium">
                    Categoria
                  </th>
                  {meses.map((m) => (
                    <th
                      key={m.chave}
                      title={m.label}
                      className="whitespace-nowrap px-3 py-3 text-right font-medium"
                    >
                      {labelCurto(m)}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {linhas.map((linha) => {
                  const rowMax = Math.max(...linha.valores, 0);
                  return (
                    <tr key={linha.id ?? "sem-categoria"} className="hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px]"
                            style={{ backgroundColor: linha.cor, color: "#fff" }}
                            aria-hidden
                          >
                            {linha.emoji ?? linha.nome[0]?.toUpperCase() ?? "?"}
                          </span>
                          <span className="whitespace-nowrap font-medium">
                            {linha.nome}
                          </span>
                        </span>
                      </td>
                      {linha.valores.map((valor, i) => {
                        const pct = rowMax > 0 ? valor / rowMax : 0;
                        return (
                          <td
                            key={meses[i].chave}
                            className="whitespace-nowrap px-3 py-3 text-right tabular-nums"
                            style={{
                              backgroundColor:
                                valor > 0
                                  ? `color-mix(in srgb, ${linha.cor} ${Math.round(pct * 40)}%, transparent)`
                                  : undefined,
                            }}
                          >
                            {valor > 0 ? (
                              formatBRL(valor)
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-primary">
                        {formatBRL(linha.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-medium">
                  <td className="sticky left-0 z-10 bg-muted/40 px-4 py-3">
                    Total
                  </td>
                  {totalPorMes.map((valor, i) => (
                    <td
                      key={meses[i].chave}
                      className="whitespace-nowrap px-3 py-3 text-right tabular-nums"
                    >
                      {formatBRL(valor)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-primary">
                    {formatBRL(totalGeral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
