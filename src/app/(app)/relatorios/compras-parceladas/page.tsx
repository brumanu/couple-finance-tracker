import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias-server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mesAtual, buildMes } from "@/lib/mes";
import {
  mesPrimeiraParcela,
  parcelaNoMes,
  valoresParcelas,
  type CompraCartaoInfo,
} from "@/lib/cartao-calc";
import {
  RelatorioComprasParceladasClient,
  type LinhaRelatorio,
  type CartaoOpcaoRel,
} from "./relatorio-client";

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

export default async function RelatorioComprasParceladasPage() {
  const supabase = await createClient();
  const hoje = mesAtual();

  const [, comprasRes, cartoesRes, bancosRes, categorias] = await Promise.all([
    requireSession(),
    supabase
      .from("compras_cartao")
      .select(
        "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria, categoria_id",
      )
      .gt("parcelas", 1)
      .order("data_compra", { ascending: false }),
    supabase.from("cartoes").select("id, banco_id, apelido, dia_fechamento"),
    supabase.from("bancos").select("id, nome, cor, icone"),
    getCategorias(),
  ]);

  const compras = (comprasRes.data ?? []) as CompraRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
  const bancos = (bancosRes.data ?? []) as BancoRow[];
  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));
  const bancoById = new Map(bancos.map((b) => [b.id, b] as const));

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
    const valorUltimaParcela = valores[c.parcelas - 1];

    // Use parcelaNoMes for consistent calculation with the dashboard
    const compraInfo: CompraCartaoInfo = {
      id: c.id,
      cartao_id: c.cartao_id,
      descricao: c.descricao,
      valor_total: c.valor_total,
      data_compra: c.data_compra,
      parcelas: c.parcelas,
      parcelas_ja_pagas: c.parcelas_ja_pagas ?? undefined,
      categoria: c.categoria,
    };
    const infoHoje = parcelaNoMes(compraInfo, diaFech, hoje);

    // Compute última parcela month
    const totalMesesUltima = primeira.mes + c.parcelas - 1;
    const anoUltima = primeira.ano + Math.floor((totalMesesUltima - 1) / 12);
    const mesUltima = ((totalMesesUltima - 1) % 12) + 1;
    const ultima = buildMes(anoUltima, mesUltima);

    let parcelaAtual: number;
    let valorParcela: number;
    let faltaPagar: number;
    let parcelasRestantes: number;
    let status: LinhaRelatorio["status"];

    if (infoHoje) {
      // Active installment this month
      parcelaAtual = infoHoje.numero;
      valorParcela = infoHoje.valor;
      faltaPagar = Number((infoHoje.valor + infoHoje.restanteAposEste).toFixed(2));
      parcelasRestantes = c.parcelas - infoHoje.numero + 1;
      status = "ativa";
    } else {
      // No active installment: either hasn't started or already finished
      const diffMeses =
        (hoje.ano - primeira.ano) * 12 + (hoje.mes - primeira.mes);
      if (diffMeses < 0) {
        // Purchase hasn't started billing yet
        status = "aguardando";
        parcelaAtual = 1;
        valorParcela = valores[0];
        faltaPagar = Number(Number(c.valor_total).toFixed(2));
        parcelasRestantes = c.parcelas;
      } else {
        // All installments done
        status = "quitada";
        parcelaAtual = c.parcelas;
        valorParcela = valorUltimaParcela;
        faltaPagar = 0;
        parcelasRestantes = 0;
      }
    }

    return {
      id: c.id,
      descricao: c.descricao,
      categoria: c.categoria,
      categoriaId: c.categoria_id,
      cartaoId: c.cartao_id,
      cartaoLabel,
      bancoIcone: banco?.icone ?? null,
      bancoCor: banco?.cor ?? "#c67139",
      bancoNome: banco?.nome ?? cartaoLabel,
      dataCompra: c.data_compra,
      valorTotal: Number(c.valor_total),
      parcelas: c.parcelas,
      parcelaAtual,
      valorParcela,
      valorUltimaParcela,
      faltaPagar,
      parcelasRestantes,
      primeiraChave: `${primeira.ano}-${pad2(primeira.mes)}`,
      primeiraLabel: labelMesAbrev(primeira.ano, primeira.mes),
      ultimaChave: `${ultima.ano}-${pad2(ultima.mes)}`,
      ultimaLabel: labelMesAbrev(ultima.ano, ultima.mes),
      ultimaAno: ultima.ano,
      ultimaMes: ultima.mes,
      status,
    };
  });

  // Opções pros dropdowns de filtro — só cartões que aparecem no relatório
  const cartaoIdsPresentes = new Set(linhas.map((l) => l.cartaoId));
  const cartaoOptions: CartaoOpcaoRel[] = cartoes
    .filter((c) => cartaoIdsPresentes.has(c.id))
    .map((c) => {
      const banco = bancoById.get(c.banco_id);
      const label = banco?.nome
        ? c.apelido
          ? `${banco.nome} · ${c.apelido}`
          : banco.nome
        : (c.apelido ?? "Cartão");
      return {
        id: c.id,
        label,
        bancoIcone: banco?.icone ?? null,
        bancoCor: banco?.cor ?? "#c67139",
        bancoNome: banco?.nome ?? label,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  // Só categorias efetivamente usadas por alguma compra parcelada
  const categoriaIdsPresentes = new Set(
    linhas.map((l) => l.categoriaId).filter((x): x is string => Boolean(x)),
  );
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
            Compras parceladas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as compras parceladas de todos os cartões — status
            calculado com base em {hoje.label}.
          </p>
        </div>
      </header>

      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma compra parcelada registrada em nenhum cartão.
            </p>
          </div>
        </Card>
      ) : (
        <RelatorioComprasParceladasClient
          linhas={linhas}
          cartaoOptions={cartaoOptions}
          categoriaOptions={categoriaOptions}
        />
      )}
    </div>
  );
}
