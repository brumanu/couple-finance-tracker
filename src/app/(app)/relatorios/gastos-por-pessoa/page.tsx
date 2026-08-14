import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseMesParam } from "@/lib/mes";
import { parcelaNoMes, assinaturaAtivaNoMes } from "@/lib/cartao-calc";
import { formatBRL } from "@/lib/format";
import { MonthSwitcher } from "../../month-switcher";

type ProfileRow = {
  id: string;
  nome: string;
  papel: string;
};

type LancamentoRow = {
  id: string;
  tipo: string;
  valor: number | string;
  data_referencia: string;
  data_pagamento: string | null;
  conta_recorrente_id: string | null;
  criado_por: string | null;
};

type RecorrenteRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
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
  criado_por: string | null;
};

type AssinaturaRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
  criada_por: string | null;
};

type CartaoRow = {
  id: string;
  dia_fechamento: number;
};

type PessoaAgg = {
  id: string;
  nome: string;
  papel: string;
  despesaAvulsa: number;
  contaFixaPaga: number;
  compraCartao: number;
  assinatura: number;
  total: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
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

  const [session, lancRes, contasRes, comprasRes, assinRes, cartoesRes] =
    await Promise.all([
      requireSession(),
      supabase
        .from("lancamentos")
        .select(
          "id, tipo, valor, data_referencia, data_pagamento, conta_recorrente_id, criado_por",
        )
        .in("tipo", ["despesa_avulsa", "conta_fixa"])
        .gte("data_referencia", mes.primeiroDia)
        .lte("data_referencia", mes.ultimoDia),
      supabase
        .from("contas_recorrentes")
        .select("id, descricao, valor_previsto, inicio_vigencia, fim_vigencia, ativa")
        .eq("ativa", true)
        .lte("inicio_vigencia", mes.ultimoDia)
        .or(`fim_vigencia.is.null,fim_vigencia.gte.${mes.primeiroDia}`),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, criado_por",
        )
        .gte("data_compra", comprasCutoff)
        .lte("data_compra", mes.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, descricao, valor_mensal, inicio_vigencia, fim_vigencia, ativa, criada_por",
        )
        .eq("ativa", true),
      supabase.from("cartoes").select("id, dia_fechamento"),
    ]);

  // Query de profiles depende do casalId retornado pela sessão, por isso
  // roda separada (não dá pra colocar no Promise.all acima).
  const profilesRes = await supabase
    .from("profiles")
    .select("id, nome, papel")
    .eq("casal_id", session.casalId)
    .order("papel", { ascending: true })
    .order("nome", { ascending: true });

  const lancamentos = (lancRes.data ?? []) as LancamentoRow[];
  const contas = (contasRes.data ?? []) as RecorrenteRow[];
  const compras = (comprasRes.data ?? []) as CompraRow[];
  const assinaturas = (assinRes.data ?? []) as AssinaturaRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];

  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));

  const pessoaAgg = new Map<string, PessoaAgg>();
  for (const p of profiles) {
    pessoaAgg.set(p.id, {
      id: p.id,
      nome: p.nome,
      papel: p.papel,
      despesaAvulsa: 0,
      contaFixaPaga: 0,
      compraCartao: 0,
      assinatura: 0,
      total: 0,
    });
  }

  // Gasto com criado_por/criada_por que não bate com nenhum profile do
  // casal atual (não deveria acontecer em uso normal, já que toda
  // gravação registra o autor — mas não deixa quebrar a tela). Entra no
  // total do casal, só não é atribuído a nenhuma pessoa específica.
  let naoIdentificado = 0;

  function creditar(pessoaId: string | null, campo: keyof PessoaAgg, valor: number) {
    const p = pessoaId ? pessoaAgg.get(pessoaId) : undefined;
    if (!p) {
      naoIdentificado += valor;
      return;
    }
    (p[campo] as number) += valor;
  }

  // Despesas avulsas lançadas no mês.
  for (const l of lancamentos) {
    if (l.tipo !== "despesa_avulsa") continue;
    creditar(l.criado_por, "despesaAvulsa", Number(l.valor));
  }

  // Contas fixas: se já tem lançamento (paga) no mês, atribui a quem
  // registrou o pagamento. Se ainda não foi paga, é só uma previsão — não
  // foi ninguém que gastou de fato ainda, então vai pro bucket separado
  // "não atribuído (previsto)" em vez de para uma das duas pessoas.
  const pagosMes = new Map<string, LancamentoRow>();
  for (const l of lancamentos) {
    if (l.tipo === "conta_fixa" && l.conta_recorrente_id) {
      pagosMes.set(l.conta_recorrente_id, l);
    }
  }
  let naoAtribuidoPrevisto = 0;
  for (const c of contas) {
    const pago = pagosMes.get(c.id);
    if (pago) {
      creditar(pago.criado_por, "contaFixaPaga", Number(pago.valor));
    } else {
      naoAtribuidoPrevisto += Number(c.valor_previsto);
    }
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
    creditar(compra.criado_por, "compraCartao", info.valor);
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
    creditar(a.criada_por, "assinatura", Number(a.valor_mensal));
  }

  for (const p of pessoaAgg.values()) {
    p.total = Number(
      (
        p.despesaAvulsa +
        p.contaFixaPaga +
        p.compraCartao +
        p.assinatura
      ).toFixed(2),
    );
  }

  const pessoas = Array.from(pessoaAgg.values());
  const totalPessoas = pessoas.reduce((s, p) => s + p.total, 0);
  const totalCasal = Number(
    (totalPessoas + naoAtribuidoPrevisto + naoIdentificado).toFixed(2),
  );

  const grandTotal = totalCasal;

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
            Quanto cada um gastou em {mes.label}, com base em quem registrou
            cada despesa avulsa, conta fixa paga, compra no cartão e
            assinatura.
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
          <div className="grid gap-3 md:grid-cols-3">
            <ResumoCard
              label={`Total do casal em ${mes.label}`}
              valor={formatBRL(totalCasal)}
              destaque
            />
            <DiferencaCard pessoas={pessoas} />
            <ResumoCard
              label="Não atribuído (previsto)"
              valor={formatBRL(naoAtribuidoPrevisto)}
              hint="contas fixas ainda não pagas"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {pessoas.map((p, i) => (
              <PessoaCard key={p.id} pessoa={p} cor={i === 0 ? "primary" : "sage"} />
            ))}
          </div>

          {pessoas.length >= 2 && (
            <ComparacaoBar pessoaA={pessoas[0]} pessoaB={pessoas[1]} />
          )}

          <Card>
            <div className="flex flex-col gap-1.5 p-5">
              <p className="text-[11px] uppercase tracking-widest text-primary">
                Sobre o não atribuído
              </p>
              <p className="text-sm text-muted-foreground">
                Contas fixas de {mes.label} que ainda não foram pagas entram
                aqui pelo valor previsto (
                <strong className="text-foreground">
                  {formatBRL(naoAtribuidoPrevisto)}
                </strong>
                ). Como ninguém pagou ainda, não faz sentido atribuir esse
                valor a uma das duas pessoas — assim que a conta for paga, o
                lançamento passa a contar pra quem registrou o pagamento.
              </p>
              {naoIdentificado > 0 && (
                <p className="text-xs text-muted-foreground">
                  Além disso, {formatBRL(naoIdentificado)} em gastos do mês
                  não puderam ser vinculados a nenhuma das duas pessoas e
                  entram apenas no total do casal.
                </p>
              )}
            </div>
          </Card>
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

function DiferencaCard({ pessoas }: { pessoas: PessoaAgg[] }) {
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

function PessoaCard({
  pessoa,
  cor,
}: {
  pessoa: PessoaAgg;
  cor: "primary" | "sage";
}) {
  const itens: { label: string; valor: number }[] = [
    { label: "Despesas avulsas", valor: pessoa.despesaAvulsa },
    { label: "Contas fixas pagas", valor: pessoa.contaFixaPaga },
    { label: "Compras no cartão", valor: pessoa.compraCartao },
    { label: "Assinaturas", valor: pessoa.assinatura },
  ];

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-heading text-lg leading-tight">
              {pessoa.nome}
            </p>
            <Badge variant="neutral" className="mt-1 text-[10px]">
              {pessoa.papel === "titular" ? "Titular" : "Cônjuge"}
            </Badge>
          </div>
          <p
            className={`shrink-0 font-heading tabular-nums ${
              cor === "primary" ? "text-primary" : "text-sage-700"
            }`}
            style={{ fontSize: "clamp(1.4rem, 3vw, 1.8rem)", lineHeight: 1 }}
          >
            {formatBRL(pessoa.total)}
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
}: {
  pessoaA: PessoaAgg;
  pessoaB: PessoaAgg;
}) {
  const maximo = Math.max(pessoaA.total, pessoaB.total, 1);
  const barras = [
    { pessoa: pessoaA, cor: "bg-primary" },
    { pessoa: pessoaB, cor: "bg-sage-500" },
  ];

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Quem gastou mais
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparação direta do total gasto por cada pessoa no mês.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {barras.map(({ pessoa, cor }) => {
            const larguraPct =
              maximo > 0 ? (pessoa.total / maximo) * 100 : 0;
            return (
              <div key={pessoa.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{pessoa.nome}</span>
                  <span className="tabular-nums text-sm font-medium">
                    {formatBRL(pessoa.total)}
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
