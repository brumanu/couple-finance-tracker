import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias-server";
import { categoriasDaLinha } from "@/lib/categorias-extras";
import { dadosDoMes, type LancamentoDoMes } from "@/lib/gastos-do-mes";
import { getMembrosCasal } from "@/lib/membros-server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseMesParam } from "@/lib/mes";
import { parcelaNoMes, assinaturaAtivaNoMes } from "@/lib/cartao-calc";
import { MonthSwitcher } from "../../month-switcher";
import type { DespesaRow } from "../../despesas/despesa-form-dialog";
import {
  RelatorioComprasDoMesClient,
  type LinhaCompra,
} from "./relatorio-client";



type BancoRow = {
  id: string;
  nome: string;
};

export default async function RelatorioComprasDoMesPage({
  searchParams,
}: PageProps<"/relatorios/compras-do-mes">) {
  const supabase = await createClient();

  const sp = await searchParams;
  const mesParam = typeof sp.mes === "string" ? sp.mes : undefined;
  const mes = parseMesParam(mesParam);

  const [, dados, bancosRes, categorias, membros] = await Promise.all([
    requireSession(),
    dadosDoMes(mes),
    // Só esta tela mostra o nome do banco em cada linha.
    supabase.from("bancos").select("id, nome"),
    getCategorias(),
    getMembrosCasal(),
  ]);

  const { lancamentos, contas, compras, assinaturas, cartoes } = dados;
  const bancos = (bancosRes.data ?? []) as BancoRow[];
  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));
  const bancoById = new Map(bancos.map((b) => [b.id, b] as const));
  const categoriaById = new Map(categorias.map((c) => [c.id, c] as const));

  function nomeCategoria(id: string | null): string | null {
    return id ? (categoriaById.get(id)?.nome ?? null) : null;
  }

  // Mesma composição de rótulo usada na tela de cartões: "Banco · Apelido".
  function nomeCartao(cartaoId: string): string {
    const cartao = cartaoById.get(cartaoId);
    if (!cartao) return "Cartão";
    const banco = bancoById.get(cartao.banco_id);
    if (banco?.nome) {
      return cartao.apelido ? `${banco.nome} · ${cartao.apelido}` : banco.nome;
    }
    return cartao.apelido ?? "Cartão";
  }

  const linhas: LinhaCompra[] = [];

  // Despesas avulsas lançadas no mês.
  for (const l of lancamentos) {
    if (l.tipo !== "despesa_avulsa") continue;
    const despesa: DespesaRow = {
      id: l.id,
      descricao: l.descricao,
      valor: l.valor,
      data_pagamento: l.data_pagamento,
      data_referencia: l.data_referencia,
      quinzena: l.quinzena,
      categoria: l.categoria,
      categoria_id: l.categoria_id,
      categorias_extras: l.categorias_extras,
      quem_gastou: l.quem_gastou,
    };
    linhas.push({
      id: `despesa-${l.id}`,
      tipo: "despesa",
      categoriaId: l.categoria_id,
      categoriaIds: categoriasDaLinha(l),
      categoriaNome: nomeCategoria(l.categoria_id),
      descricao: l.descricao,
      origem: "Despesa avulsa",
      data: l.data_pagamento ?? l.data_referencia,
      valor: Number(l.valor),
      despesa,
    });
  }

  // Contas fixas vigentes no mês: paga (usa o lançamento) ou prevista.
  const pagosMes = new Map<string, LancamentoDoMes>();
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
      tipo: "conta_fixa",
      categoriaId,
      // Conta fixa não participa das categorias extras: é definição
      // recorrente, onde uma categoria basta.
      categoriaIds: categoriaId ? [categoriaId] : [],
      categoriaNome: nomeCategoria(categoriaId),
      descricao: c.descricao,
      origem: pago ? "Conta fixa · paga" : "Conta fixa · prevista",
      data: pago?.data_pagamento ?? null,
      valor: pago ? Number(pago.valor) : Number(c.valor_previsto),
      recorrente: c,
    });
  }

  // Compras no cartão: só a parcela ativa no mês alvo, se houver.
  for (const compra of compras) {
    const cartao = cartaoById.get(compra.cartao_id);
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
      cartao,
      mes,
    );
    if (!info) continue;
    linhas.push({
      id: `compra-${compra.id}`,
      tipo: "compra_cartao",
      categoriaId: compra.categoria_id,
      categoriaIds: categoriasDaLinha(compra),
      categoriaNome: nomeCategoria(compra.categoria_id),
      descricao: compra.descricao,
      origem:
        compra.parcelas > 1
          ? `Compra no cartão (parcela ${info.numero}/${info.total})`
          : "Compra no cartão (à vista)",
      data: compra.data_compra,
      valor: info.valor,
      compra,
      cartaoNome: nomeCartao(compra.cartao_id),
      diaFechamento: cartao?.dia_fechamento ?? 1,
      diaVencimento: cartao?.dia_vencimento ?? 10,
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
      tipo: "assinatura",
      categoriaId: a.categoria_id,
      categoriaIds: a.categoria_id ? [a.categoria_id] : [],
      categoriaNome: nomeCategoria(a.categoria_id),
      descricao: a.descricao,
      origem: "Assinatura",
      data: null,
      valor: Number(a.valor_mensal),
      assinatura: a,
      cartaoNome: nomeCartao(a.cartao_id),
      ativaHoje: ativaNoMes,
    });
  }

  // O filtro oferece toda categoria que aparece no mês, principal ou extra —
  // senão marcar "Farmácia" não acharia a compra do mercado que também levou
  // remédio, que é justamente o caso que as extras existem pra resolver.
  const categoriaIdsPresentes = new Set(linhas.flatMap((l) => l.categoriaIds));
  const temSemCategoria = linhas.some((l) => l.categoriaIds.length === 0);
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
            Todas as compras do mês
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Despesas avulsas, contas fixas, compras no cartão e assinaturas de{" "}
            {mes.label} — edite ou exclua direto daqui pra corrigir
            categorias erradas.
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
        <RelatorioComprasDoMesClient
          linhas={linhas}
          categoriaOptions={categoriaOptions}
          todasCategorias={categorias}
          temSemCategoria={temSemCategoria}
          mesLabel={mes.label}
          membros={membros}
        />
      )}
    </div>
  );
}
