import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BancoIcone } from "@/lib/bancos-icones";
import { formatBRL } from "@/lib/format";
import { mesAtual, buildMes } from "@/lib/mes";
import {
  mesPrimeiraParcela,
  valoresParcelas,
  type CompraCartaoInfo,
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
};

type CartaoRow = {
  id: string;
  banco_id: string;
  apelido: string | null;
  dia_fechamento: number;
};

type BancoRow = {
  id: string;
  nome: string;
  cor: string;
  icone: string | null;
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

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

export default async function RelatorioComprasParceladasPage() {
  await requireSession();
  const supabase = await createClient();
  const hoje = mesAtual();

  const [comprasRes, cartoesRes, bancosRes] = await Promise.all([
    supabase
      .from("compras_cartao")
      .select(
        "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria",
      )
      .gt("parcelas", 1)
      .order("data_compra", { ascending: false }),
    supabase
      .from("cartoes")
      .select("id, banco_id, apelido, dia_fechamento"),
    supabase.from("bancos").select("id, nome, cor, icone"),
  ]);

  const compras = (comprasRes.data ?? []) as CompraRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
  const bancos = (bancosRes.data ?? []) as BancoRow[];
  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));
  const bancoById = new Map(bancos.map((b) => [b.id, b] as const));

  type LinhaRelatorio = {
    compra: CompraRow;
    cartaoLabel: string;
    bancoIcone: string | null;
    bancoCor: string;
    bancoNome: string;
    parcelaAtual: number; // 0 se ainda não começou; >parcelas se acabou
    valorParcela: number;
    faltaPagar: number;
    parcelasRestantes: number;
    primeiraLabel: string;
    ultimaLabel: string;
    status: "aguardando" | "ativa" | "quitada";
  };

  const linhas: LinhaRelatorio[] = compras.map((c) => {
    const cartao = cartaoById.get(c.cartao_id);
    const banco = cartao ? bancoById.get(cartao.banco_id) : undefined;
    const cartaoLabel = banco?.nome
      ? cartao?.apelido
        ? `${banco.nome} · ${cartao.apelido}`
        : banco.nome
      : (cartao?.apelido ?? "Cartão");

    const diaFech = cartao?.dia_fechamento ?? 1;
    const primeira = mesPrimeiraParcela(c.data_compra, diaFech);
    const valores = valoresParcelas(Number(c.valor_total), c.parcelas);

    // Quantos meses se passaram desde a primeira parcela até hoje (inclusivo)
    const diffMeses =
      (hoje.ano - primeira.ano) * 12 + (hoje.mes - primeira.mes);
    // Índice 0-based da parcela atual; ex: se diffMeses=0, é parcela 1
    const parcelaAtual =
      diffMeses < 0 ? 0 : Math.min(c.parcelas, diffMeses + 1);

    // Parcelas efetivamente pagas: max(já pagas cadastradas, parcelaAtual - 1)
    // — pra compras normais, parcelas_ja_pagas fica 0 e o cálculo é temporal.
    const pagasReal = Math.max(
      c.parcelas_ja_pagas ?? 0,
      Math.max(0, parcelaAtual - 1),
    );
    const parcelasRestantes = Math.max(0, c.parcelas - pagasReal);
    const faltaPagar = valores
      .slice(pagasReal)
      .reduce((s, v) => s + v, 0);

    // Última parcela
    const totalMesesUltima = primeira.mes + c.parcelas - 1;
    const anoUltima = primeira.ano + Math.floor((totalMesesUltima - 1) / 12);
    const mesUltima = ((totalMesesUltima - 1) % 12) + 1;
    const ultima = buildMes(anoUltima, mesUltima);

    const valorParcela =
      parcelaAtual >= 1 && parcelaAtual <= c.parcelas
        ? valores[parcelaAtual - 1]
        : valores[0];

    let status: LinhaRelatorio["status"] = "ativa";
    if (parcelaAtual === 0) status = "aguardando";
    else if (pagasReal >= c.parcelas) status = "quitada";

    return {
      compra: c,
      cartaoLabel,
      bancoIcone: banco?.icone ?? null,
      bancoCor: banco?.cor ?? "#c67139",
      bancoNome: banco?.nome ?? cartaoLabel,
      parcelaAtual: Math.max(1, parcelaAtual),
      valorParcela,
      faltaPagar: Number(faltaPagar.toFixed(2)),
      parcelasRestantes,
      primeiraLabel: labelMesAbrev(primeira.ano, primeira.mes),
      ultimaLabel: labelMesAbrev(ultima.ano, ultima.mes),
      status,
    };
  });

  const totalCompras = linhas.length;
  const totalFalta = linhas.reduce((s, l) => s + l.faltaPagar, 0);
  const totalOriginal = compras.reduce((s, c) => s + Number(c.valor_total), 0);

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
            Compras parceladas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as compras parceladas de todos os cartões — status
            calculado com base em {hoje.label}.
          </p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumoCard
          label="Total de compras"
          valor={String(totalCompras)}
          hint={totalCompras === 1 ? "compra" : "compras"}
        />
        <ResumoCard
          label="Valor total original"
          valor={formatBRL(totalOriginal)}
        />
        <ResumoCard
          label="Falta pagar"
          valor={formatBRL(totalFalta)}
          destaque
        />
      </div>

      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma compra parcelada registrada em nenhum cartão.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop: tabela; Mobile: cards */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Compra</th>
                  <th className="px-4 py-3 text-left font-medium">Cartão</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">
                    Parcela
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Valor parc.
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Falta pagar
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Última em
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {linhas.map((l) => (
                  <tr key={l.compra.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {l.compra.descricao}
                        </span>
                        {l.compra.categoria && (
                          <span className="mt-0.5 text-xs text-muted-foreground">
                            {l.compra.categoria}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BancoIcone
                          icone={l.bancoIcone}
                          corFallback={l.bancoCor}
                          nomeFallback={l.bancoNome}
                          size={24}
                        />
                        <span className="truncate">{l.cartaoLabel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDataBR(l.compra.data_compra)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatBRL(l.compra.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {l.status === "aguardando" ? (
                        <Badge variant="neutral" className="text-[10px]">
                          começa {l.primeiraLabel}
                        </Badge>
                      ) : l.status === "quitada" ? (
                        <Badge variant="secondary" className="text-[10px]">
                          quitada
                        </Badge>
                      ) : (
                        <span className="tabular-nums">
                          {l.parcelaAtual}/{l.compra.parcelas}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatBRL(l.valorParcela)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        l.faltaPagar > 0
                          ? "font-medium text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatBRL(l.faltaPagar)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.ultimaLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col divide-y divide-border/60 md:hidden">
            {linhas.map((l) => (
              <li key={l.compra.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start gap-3">
                  <BancoIcone
                    icone={l.bancoIcone}
                    corFallback={l.bancoCor}
                    nomeFallback={l.bancoNome}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {l.compra.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.cartaoLabel} · {formatDataBR(l.compra.data_compra)}
                    </p>
                  </div>
                  {l.status === "aguardando" ? (
                    <Badge variant="neutral" className="text-[10px]">
                      {l.primeiraLabel}
                    </Badge>
                  ) : l.status === "quitada" ? (
                    <Badge variant="secondary" className="text-[10px]">
                      quitada
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      {l.parcelaAtual}/{l.compra.parcelas}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Parcela
                    </p>
                    <p className="tabular-nums font-medium">
                      {formatBRL(l.valorParcela)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Falta
                    </p>
                    <p
                      className={`tabular-nums font-medium ${
                        l.faltaPagar > 0 ? "text-primary" : ""
                      }`}
                    >
                      {formatBRL(l.faltaPagar)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Última
                    </p>
                    <p className="font-medium">{l.ultimaLabel}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
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
          className={`font-heading tabular-nums ${
            destaque ? "text-primary" : ""
          }`}
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", lineHeight: 1 }}
        >
          {valor}
        </p>
        {hint && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    </Card>
  );
}
