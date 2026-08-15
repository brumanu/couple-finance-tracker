import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMembrosCasal } from "@/lib/membros-server";
import { QUEM_CASAL } from "@/lib/membros";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseMesParam } from "@/lib/mes";
import { parcelaNoMes, assinaturaAtivaNoMes } from "@/lib/cartao-calc";
import { formatBRL } from "@/lib/format";
import { MonthSwitcher } from "../../month-switcher";

type LancamentoRow = {
  id: string;
  tipo: string;
  valor: number | string;
  data_referencia: string;
  data_pagamento: string | null;
  conta_recorrente_id: string | null;
  quem_gastou: string | null;
};

type RecorrenteRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
  quem_gastou: string | null;
};

type CompraRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number | null;
  quem_gastou: string | null;
};

type AssinaturaRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
  quem_gastou: string | null;
};

type CartaoRow = {
  id: string;
  dia_fechamento: number;
};

// Chave usada no Map de agregação pra itens sem `quem_gastou` definido
// (null/""). Não é um valor real de `quem_gastou` — só uma sentinela
// interna pra não colidir com uuids de profile nem com QUEM_CASAL.
const NAO_ESPECIFICADO = "__nao_especificado__";

type GrupoAgg = {
  id: string;
  nome: string;
  despesaAvulsa: number;
  contaFixa: number;
  compraCartao: number;
  assinatura: number;
  total: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function novoGrupo(id: string, nome: string): GrupoAgg {
  return {
    id,
    nome,
    despesaAvulsa: 0,
    contaFixa: 0,
    compraCartao: 0,
    assinatura: 0,
    total: 0,
  };
}

export default async function RelatorioGastosPorPessoaPage({
  searchParams,
}: PageProps<"/relatorios/gastos-por-pessoa">) {
  const supabase = await createClient();

  const sp = await searchParams;
  const mesParam = typeof sp.mes === "string" ? sp.mes : undefined;
  const mes = parseMesParam(mesParam);

  // Mesmo cutoff usado no relatório de gastos-por-categoria: uma compra
  // feita há mais de 60 meses (máximo de parcelas) antes do mês alvo não
  // pode ter parcela ativa nesse mês.
  const cutoffDate = new Date(mes.ano, mes.mes - 1 - 60, 1);
  const comprasCutoff = `${cutoffDate.getFullYear()}-${pad2(cutoffDate.getMonth() + 1)}-01`;

  const [, membros, lancRes, contasRes, comprasRes, assinRes, cartoesRes] =
    await Promise.all([
      requireSession(),
      getMembrosCasal(),
      supabase
        .from("lancamentos")
        .select(
          "id, tipo, valor, data_referencia, data_pagamento, conta_recorrente_id, quem_gastou",
        )
        .in("tipo", ["despesa_avulsa", "conta_fixa"])
        .gte("data_referencia", mes.primeiroDia)
        .lte("data_referencia", mes.ultimoDia),
      supabase
        .from("contas_recorrentes")
        .select(
          "id, descricao, valor_previsto, inicio_vigencia, fim_vigencia, ativa, quem_gastou",
        )
        .eq("ativa", true)
        .lte("inicio_vigencia", mes.ultimoDia)
        .or(`fim_vigencia.is.null,fim_vigencia.gte.${mes.primeiroDia}`),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, quem_gastou",
        )
        .gte("data_compra", comprasCutoff)
        .lte("data_compra", mes.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, descricao, valor_mensal, inicio_vigencia, fim_vigencia, ativa, quem_gastou",
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

  const grupoAgg = new Map<string, GrupoAgg>();
  for (const m of membros) {
    grupoAgg.set(m.id, novoGrupo(m.id, m.nome));
  }
  grupoAgg.set(QUEM_CASAL, novoGrupo(QUEM_CASAL, "Casal"));

  function creditar(
    quemGastou: string | null | undefined,
    campo: keyof Omit<GrupoAgg, "id" | "nome">,
    valor: number,
  ) {
    const bruto = (quemGastou ?? "").trim();
    const key = bruto === "" ? NAO_ESPECIFICADO : bruto;
    let grupo = grupoAgg.get(key);
    if (!grupo) {
      // uuid de profile fora do casal atual (não deveria acontecer, já
      // que a validação em resolverQuemGastou garante isso na escrita)
      // ou a sentinela de "não especificado" — mesmo tratamento: entra
      // no total do casal, mas não é atribuído a ninguém específico.
      grupo = novoGrupo(NAO_ESPECIFICADO, "Não especificado");
      grupoAgg.set(NAO_ESPECIFICADO, grupo);
    }
    grupo[campo] += valor;
  }

  // Despesas avulsas lançadas no mês.
  for (const l of lancamentos) {
    if (l.tipo !== "despesa_avulsa") continue;
    creditar(l.quem_gastou, "despesaAvulsa", Number(l.valor));
  }

  // Contas fixas: `quem_gastou` vive na definição da conta recorrente, não
  // no lançamento de pagamento — então já dá pra atribuir mesmo antes de
  // paga (usa o valor previsto). Se já foi paga no mês, usa o valor real
  // do lançamento em vez do previsto.
  const pagosMes = new Map<string, LancamentoRow>();
  for (const l of lancamentos) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagosMes.set(l.conta_recorrente_id, l);
    }
  }
  for (const c of contas) {
    const pago = pagosMes.get(c.id);
    const valor = pago ? Number(pago.valor) : Number(c.valor_previsto);
    creditar(c.quem_gastou, "contaFixa", valor);
  }

  // Compras no cartão: só a parcela ativa no mês alvo.
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
    creditar(compra.quem_gastou, "compraCartao", info.valor);
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
    creditar(a.quem_gastou, "assinatura", Number(a.valor_mensal));
  }

  for (const g of grupoAgg.values()) {
    g.total = Number(
      (g.despesaAvulsa + g.contaFixa + g.compraCartao + g.assinatura).toFixed(
        2,
      ),
    );
  }

  const pessoas = membros
    .map((m) => grupoAgg.get(m.id))
    .filter((g): g is GrupoAgg => Boolean(g));
  const casal = grupoAgg.get(QUEM_CASAL)!;
  const naoEspecificado =
    grupoAgg.get(NAO_ESPECIFICADO) ?? novoGrupo(NAO_ESPECIFICADO, "Não especificado");

  const grandTotal = Number(
    Array.from(grupoAgg.values())
      .reduce((s, g) => s + g.total, 0)
      .toFixed(2),
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
            Gastos por pessoa
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Quanto cada um gastou em {mes.label}, com base em quem foi
            marcado como responsável por cada despesa avulsa, conta fixa,
            compra no cartão e assinatura.
          </p>
        </div>
        <MonthSwitcher mes={mes} />
      </header>

      {grandTotal === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum gasto registrado em {mes.label}.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <ResumoCard
              label={`Total do casal em ${mes.label}`}
              valor={formatBRL(grandTotal)}
              destaque
            />
            <DiferencaCard pessoas={pessoas} />
            <ResumoCard
              label="Casal (compartilhado)"
              valor={formatBRL(casal.total)}
              hint="gastos que não são de um só"
            />
            <ResumoCard
              label="Não especificado"
              valor={formatBRL(naoEspecificado.total)}
              hint="ainda sem responsável definido"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {pessoas.map((p, i) => (
              <GrupoCard key={p.id} grupo={p} cor={i === 0 ? "primary" : "sage"} />
            ))}
            <GrupoCard grupo={casal} cor="accent" />
          </div>

          {pessoas.length >= 2 && (
            <ComparacaoBar pessoaA={pessoas[0]} pessoaB={pessoas[1]} casal={casal} />
          )}

          {naoEspecificado.total > 0 && (
            <Card>
              <div className="flex flex-col gap-1.5 p-5">
                <p className="text-[11px] uppercase tracking-widest text-primary">
                  Sobre o não especificado
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatBRL(naoEspecificado.total)} em gastos de{" "}
                  {mes.label} ainda não têm um responsável (&quot;quem
                  gastou&quot;) definido — entram só no total do casal, sem
                  aparecer no card de nenhuma das duas pessoas nem no do
                  casal. Isso pode acontecer com lançamentos antigos, de
                  antes desse campo existir, ou itens criados sem marcar
                  quem gastou.
                </p>
                <p className="text-xs text-muted-foreground">
                  Dá pra corrigir editando cada item em{" "}
                  <Link
                    href={`/relatorios/compras-do-mes?mes=${mes.chave}`}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Todas as compras do mês
                  </Link>
                  .
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
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
          className={`font-heading tabular-nums truncate ${
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

function DiferencaCard({ pessoas }: { pessoas: GrupoAgg[] }) {
  if (pessoas.length < 2) {
    return <ResumoCard label="Diferença entre os dois" valor="—" />;
  }
  const [a, b] = pessoas;
  const diff = Math.abs(a.total - b.total);
  const maior = a.total >= b.total ? a : b;
  const menor = a.total >= b.total ? b : a;
  // Percentual "a mais" calculado em cima do menor valor — se não há base
  // de comparação (menor === 0), mostra só o valor em reais.
  const pct = menor.total > 0 ? (diff / menor.total) * 100 : null;

  return (
    <ResumoCard
      label="Diferença entre os dois"
      valor={formatBRL(diff)}
      hint={
        diff === 0
          ? "gastaram o mesmo"
          : `${maior.nome} gastou ${pct !== null ? `${pct.toFixed(0)}% ` : ""}a mais que ${menor.nome}`
      }
    />
  );
}

function GrupoCard({
  grupo,
  cor,
}: {
  grupo: GrupoAgg;
  cor: "primary" | "sage" | "accent";
}) {
  const itens: { label: string; valor: number }[] = [
    { label: "Despesas avulsas", valor: grupo.despesaAvulsa },
    { label: "Contas fixas", valor: grupo.contaFixa },
    { label: "Compras no cartão", valor: grupo.compraCartao },
    { label: "Assinaturas", valor: grupo.assinatura },
  ];

  const corTexto =
    cor === "primary"
      ? "text-primary"
      : cor === "sage"
        ? "text-sage-700"
        : "text-accent-700";

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-heading text-lg leading-tight">
              {grupo.nome}
            </p>
          </div>
          <p
            className={`shrink-0 font-heading tabular-nums ${corTexto}`}
            style={{ fontSize: "clamp(1.4rem, 3vw, 1.8rem)", lineHeight: 1 }}
          >
            {formatBRL(grupo.total)}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
          {itens.map((it) => (
            <div key={it.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{it.label}</span>
              <span className="tabular-nums font-medium">
                {formatBRL(it.valor)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ComparacaoBar({
  pessoaA,
  pessoaB,
  casal,
}: {
  pessoaA: GrupoAgg;
  pessoaB: GrupoAgg;
  casal: GrupoAgg;
}) {
  const maximo = Math.max(pessoaA.total, pessoaB.total, casal.total, 1);
  const barras = [
    { grupo: pessoaA, cor: "bg-primary" },
    { grupo: pessoaB, cor: "bg-sage-500" },
    { grupo: casal, cor: "bg-accent-500" },
  ];

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Quem gastou mais
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparação direta do total gasto por cada pessoa e pelo casal no
            mês.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {barras.map(({ grupo, cor }) => {
            const larguraPct = maximo > 0 ? (grupo.total / maximo) * 100 : 0;
            return (
              <div key={grupo.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{grupo.nome}</span>
                  <span className="tabular-nums text-sm font-medium">
                    {formatBRL(grupo.total)}
                  </span>
                </div>
                <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={`h-full rounded-full ${cor}`}
                    style={{ width: `${Math.max(2, larguraPct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
