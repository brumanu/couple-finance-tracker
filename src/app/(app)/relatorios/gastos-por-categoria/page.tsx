import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias-server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseMesParam } from "@/lib/mes";
import { parcelaNoMes, assinaturaAtivaNoMes } from "@/lib/cartao-calc";
import { MonthSwitcher } from "../../month-switcher";
import {
  RelatorioGastosPorCategoriaClient,
  type LinhaTransacao,
  type CategoriaResumo,
} from "./relatorio-client";

type LancamentoRow = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number | string;
  data_referencia: string;
  data_pagamento: string | null;
  categoria_id: string | null;
  conta_recorrente_id: string | null;
};

type RecorrenteRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  categoria_id: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
};

type CompraRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number | null;
  categoria_id: string | null;
};

type AssinaturaRow = {
  id: string;
  cartao_id: string;
  descricao: string;
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export default async function RelatorioGastosPorCategoriaPage({
  searchParams,
}: PageProps<"/relatorios/gastos-por-categoria">) {
  await requireSession();
  const supabase = await createClient();

  const sp = await searchParams;
  const mesParam = typeof sp.mes === "string" ? sp.mes : undefined;
  const mes = parseMesParam(mesParam);

  // Cutoff pra compras_cartao: uma compra feita há mais de 60 meses (máximo
  // de parcelas) antes do mês alvo não pode ter parcela ativa nesse mês.
  const cutoffDate = new Date(mes.ano, mes.mes - 1 - 60, 1);
  const comprasCutoff = `${cutoffDate.getFullYear()}-${pad2(cutoffDate.getMonth() + 1)}-01`;

  const [lancRes, contasRes, comprasRes, assinRes, cartoesRes, categorias] =
    await Promise.all([
      supabase
        .from("lancamentos")
        .select(
          "id, tipo, descricao, valor, data_referencia, data_pagamento, categoria_id, conta_recorrente_id",
        )
        .in("tipo", ["despesa_avulsa", "conta_fixa"])
        .gte("data_referencia", mes.primeiroDia)
        .lte("data_referencia", mes.ultimoDia),
      supabase
        .from("contas_recorrentes")
        .select(
          "id, descricao, valor_previsto, categoria_id, inicio_vigencia, fim_vigencia, ativa",
        )
        .eq("ativa", true)
        .lte("inicio_vigencia", mes.ultimoDia)
        .or(`fim_vigencia.is.null,fim_vigencia.gte.${mes.primeiroDia}`),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria_id",
        )
        .gte("data_compra", comprasCutoff)
        .lte("data_compra", mes.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, descricao, valor_mensal, categoria_id, inicio_vigencia, fim_vigencia, ativa",
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

  const transacoes: LinhaTransacao[] = [];

  // Despesas avulsas pagas/lançadas dentro do mês.
  for (const l of lancamentos) {
    if (l.tipo !== "despesa_avulsa") continue;
    transacoes.push({
      id: `lanc-${l.id}`,
      categoriaId: l.categoria_id,
      categoriaNome: l.categoria_id
        ? (categoriaById.get(l.categoria_id)?.nome ?? null)
        : null,
      descricao: l.descricao,
      origem: "Despesa avulsa",
      data: l.data_pagamento ?? l.data_referencia,
      valor: Number(l.valor),
    });
  }

  // Contas fixas vigentes no mês: paga (usa o lançamento) ou prevista
  // (fallback pro valor_previsto da definição) — mesma regra do dashboard.
  const pagosMes = new Map<string, LancamentoRow>();
  for (const l of lancamentos) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagosMes.set(l.conta_recorrente_id, l);
    }
  }
  for (const c of contas) {
    const pago = pagosMes.get(c.id);
    const categoriaId = pago ? pago.categoria_id : c.categoria_id;
    transacoes.push({
      id: `conta-${c.id}`,
      categoriaId,
      categoriaNome: categoriaId
        ? (categoriaById.get(categoriaId)?.nome ?? null)
        : null,
      descricao: c.descricao,
      origem: "Conta fixa",
      data: pago?.data_pagamento ?? null,
      valor: pago ? Number(pago.valor) : Number(c.valor_previsto),
    });
  }

  // Compras no cartão: só a parcela ativa no mês alvo, se houver.
  for (const compra of compras) {
    const cartao = cartaoById.get(compra.cartao_id);
    const diaFechamento = cartao?.dia_fechamento ?? 1;
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
      mes,
    );
    if (!info) continue;
    transacoes.push({
      id: `compra-${compra.id}`,
      categoriaId: compra.categoria_id,
      categoriaNome: compra.categoria_id
        ? (categoriaById.get(compra.categoria_id)?.nome ?? null)
        : null,
      descricao: compra.descricao,
      origem: `Compra no cartão (parcela ${info.numero}/${info.total})`,
      data: compra.data_compra,
      valor: info.valor,
    });
  }

  // Assinaturas de cartão ativas no mês alvo.
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
      mes,
    );
    if (!ativa) continue;
    transacoes.push({
      id: `assin-${a.id}`,
      categoriaId: a.categoria_id,
      categoriaNome: a.categoria_id
        ? (categoriaById.get(a.categoria_id)?.nome ?? null)
        : null,
      descricao: a.descricao,
      origem: "Assinatura",
      data: null,
      valor: Number(a.valor_mensal),
    });
  }

  const grandTotal = transacoes.reduce((s, t) => s + t.valor, 0);

  // Agrupa por categoria (null = "Sem categoria").
  const gruposMap = new Map<
    string,
    { id: string | null; total: number; qtd: number }
  >();
  for (const t of transacoes) {
    const key = t.categoriaId ?? "__sem__";
    let g = gruposMap.get(key);
    if (!g) {
      g = { id: t.categoriaId, total: 0, qtd: 0 };
      gruposMap.set(key, g);
    }
    g.total += t.valor;
    g.qtd += 1;
  }
  const categoriaResumo: CategoriaResumo[] = Array.from(gruposMap.values())
    .map((g) => {
      const cat = g.id ? categoriaById.get(g.id) : undefined;
      return {
        id: g.id,
        nome: cat?.nome ?? "Sem categoria",
        cor: cat?.cor ?? "#a3a3a3",
        emoji: cat?.emoji ?? null,
        total: Number(g.total.toFixed(2)),
        qtd: g.qtd,
        pct: grandTotal > 0 ? (g.total / grandTotal) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  const temSemCategoria = transacoes.some((t) => !t.categoriaId);

  // Só categorias efetivamente usadas por algum gasto no mês.
  const categoriaIdsPresentes = new Set(
    transacoes.map((t) => t.categoriaId).filter((x): x is string => Boolean(x)),
  );
  const categoriaOptions = categorias.filter((c) =>
    categoriaIdsPresentes.has(c.id),
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

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Gastos por categoria
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Despesas avulsas, contas fixas, compras no cartão e assinaturas de{" "}
            {mes.label}, agrupados por categoria.
          </p>
        </div>
        <MonthSwitcher mes={mes} />
      </header>

      {transacoes.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum gasto registrado em {mes.label}.
            </p>
          </div>
        </Card>
      ) : (
        <RelatorioGastosPorCategoriaClient
          transacoes={transacoes}
          categoriaResumo={categoriaResumo}
          categoriaOptions={categoriaOptions}
          temSemCategoria={temSemCategoria}
          mesLabel={mes.label}
        />
      )}
    </div>
  );
}
