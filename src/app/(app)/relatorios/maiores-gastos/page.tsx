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
  RelatorioMaioresGastosClient,
  type LinhaGasto,
} from "./relatorio-client";

type LancamentoRow = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number | string;
  data_referencia: string;
  data_pagamento: string | null;
  quinzena: number | null;
  categoria: string | null;
  categoria_id: string | null;
  conta_recorrente_id: string | null;
};

type RecorrenteRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  quinzena: number | null;
  dia_vencimento: number;
  categoria: string | null;
  categoria_id: string | null;
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
  categoria: string | null;
  categoria_id: string | null;
};

type AssinaturaRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
  categoria: string | null;
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

export default async function RelatorioMaioresGastosPage({
  searchParams,
}: PageProps<"/relatorios/maiores-gastos">) {
  const supabase = await createClient();

  const sp = await searchParams;
  const mesParam = typeof sp.mes === "string" ? sp.mes : undefined;
  const mes = parseMesParam(mesParam);

  // Cutoff pra compras_cartao: uma compra feita há mais de 60 meses (máximo
  // de parcelas) antes do mês alvo não pode ter parcela ativa nesse mês.
  const cutoffDate = new Date(mes.ano, mes.mes - 1 - 60, 1);
  const comprasCutoff = `${cutoffDate.getFullYear()}-${pad2(cutoffDate.getMonth() + 1)}-01`;

  const [, lancRes, contasRes, comprasRes, assinRes, cartoesRes, categorias] =
    await Promise.all([
      requireSession(),
      supabase
        .from("lancamentos")
        .select(
          "id, tipo, descricao, valor, data_referencia, data_pagamento, quinzena, categoria, categoria_id, conta_recorrente_id",
        )
        .in("tipo", ["despesa_avulsa", "conta_fixa"])
        .gte("data_referencia", mes.primeiroDia)
        .lte("data_referencia", mes.ultimoDia),
      supabase
        .from("contas_recorrentes")
        .select(
          "id, descricao, valor_previsto, quinzena, dia_vencimento, categoria, categoria_id, ativa",
        )
        .eq("ativa", true)
        .lte("inicio_vigencia", mes.ultimoDia)
        .or(`fim_vigencia.is.null,fim_vigencia.gte.${mes.primeiroDia}`),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria, categoria_id",
        )
        .gte("data_compra", comprasCutoff)
        .lte("data_compra", mes.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, descricao, valor_mensal, categoria, categoria_id, inicio_vigencia, fim_vigencia, ativa",
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

  function nomeCategoria(id: string | null): string | null {
    return id ? (categoriaById.get(id)?.nome ?? null) : null;
  }

  const linhas: LinhaGasto[] = [];

  // Despesas avulsas lançadas no mês.
  for (const l of lancamentos) {
    if (l.tipo !== "despesa_avulsa") continue;
    linhas.push({
      id: `despesa-${l.id}`,
      categoriaId: l.categoria_id,
      categoriaNome: nomeCategoria(l.categoria_id),
      descricao: l.descricao,
      origem: "Despesa avulsa",
      data: l.data_pagamento ?? l.data_referencia,
      valor: Number(l.valor),
    });
  }

  // Contas fixas vigentes no mês: paga (usa o lançamento) ou prevista.
  const pagosMes = new Map<string, LancamentoRow>();
  for (const l of lancamentos) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagosMes.set(l.conta_recorrente_id, l);
    }
  }
  for (const c of contas) {
    const pago = pagosMes.get(c.id);
    // O lançamento de pagamento não grava categoria própria hoje — cai pra
    // categoria da definição da conta recorrente.
    const categoriaId = pago?.categoria_id ?? c.categoria_id;
    linhas.push({
      id: `conta-${c.id}`,
      categoriaId,
      categoriaNome: nomeCategoria(categoriaId),
      descricao: c.descricao,
      origem: pago ? "Conta fixa · paga" : "Conta fixa · prevista",
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
    linhas.push({
      id: `compra-${compra.id}`,
      categoriaId: compra.categoria_id,
      categoriaNome: nomeCategoria(compra.categoria_id),
      descricao: compra.descricao,
      origem:
        compra.parcelas > 1
          ? `Compra no cartão (parcela ${info.numero}/${info.total})`
          : "Compra no cartão (à vista)",
      data: compra.data_compra,
      valor: info.valor,
    });
  }

  // Assinaturas de cartão ativas no mês alvo.
  for (const a of assinaturas) {
    const ativaNoMes = assinaturaAtivaNoMes(
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
    if (!ativaNoMes) continue;
    linhas.push({
      id: `assin-${a.id}`,
      categoriaId: a.categoria_id,
      categoriaNome: nomeCategoria(a.categoria_id),
      descricao: a.descricao,
      origem: "Assinatura",
      data: null,
      valor: Number(a.valor_mensal),
    });
  }

  const categoriaIdsPresentes = new Set(
    linhas.map((l) => l.categoriaId).filter((x): x is string => Boolean(x)),
  );
  const temSemCategoria = linhas.some((l) => !l.categoriaId);
  const categoriaOptions = categorias.filter((c) =>
    categoriaIdsPresentes.has(c.id),
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

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-4xl">
            Maiores gastos
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Os lançamentos individuais de maior valor em {mes.label} — um
            jeito rápido de identificar outliers no mês.
          </p>
        </div>
        <MonthSwitcher mes={mes} />
      </header>

      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento em {mes.label}.
            </p>
          </div>
        </Card>
      ) : (
        <RelatorioMaioresGastosClient
          linhas={linhas}
          categoriaOptions={categoriaOptions}
          todasCategorias={categorias}
          temSemCategoria={temSemCategoria}
          mesLabel={mes.label}
        />
      )}
    </div>
  );
}
