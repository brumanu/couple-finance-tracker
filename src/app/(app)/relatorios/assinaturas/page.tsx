import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias-server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mesAtual } from "@/lib/mes";
import {
  assinaturaAtivaNoMes,
  type AssinaturaCartaoInfo,
} from "@/lib/cartao-calc";
import {
  RelatorioAssinaturasClient,
  type LinhaAssinatura,
  type CartaoOpcaoRel,
} from "./relatorio-client";

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
  banco_id: string;
  apelido: string | null;
};

type BancoRow = {
  id: string;
  nome: string;
  cor: string;
  icone: string | null;
};

export default async function RelatorioAssinaturasPage() {
  const supabase = await createClient();
  const hoje = mesAtual();

  const [, assinRes, cartoesRes, bancosRes, categorias] = await Promise.all([
    requireSession(),
    supabase
      .from("assinaturas_cartao")
      .select(
        "id, cartao_id, descricao, valor_mensal, categoria, categoria_id, inicio_vigencia, fim_vigencia, ativa",
      )
      .order("descricao", { ascending: true }),
    supabase.from("cartoes").select("id, banco_id, apelido"),
    supabase.from("bancos").select("id, nome, cor, icone"),
    getCategorias(),
  ]);

  const assinaturas = (assinRes.data ?? []) as AssinaturaRow[];
  const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
  const bancos = (bancosRes.data ?? []) as BancoRow[];
  const cartaoById = new Map(cartoes.map((c) => [c.id, c] as const));
  const bancoById = new Map(bancos.map((b) => [b.id, b] as const));

  const linhas: LinhaAssinatura[] = assinaturas.map((a) => {
    const cartao = cartaoById.get(a.cartao_id);
    const banco = cartao ? bancoById.get(cartao.banco_id) : undefined;
    const cartaoLabel = banco?.nome
      ? cartao?.apelido
        ? `${banco.nome} · ${cartao.apelido}`
        : banco.nome
      : (cartao?.apelido ?? "Cartão");

    const info: AssinaturaCartaoInfo = {
      id: a.id,
      cartao_id: a.cartao_id,
      descricao: a.descricao,
      valor_mensal: a.valor_mensal,
      categoria: a.categoria,
      inicio_vigencia: a.inicio_vigencia,
      fim_vigencia: a.fim_vigencia,
      ativa: a.ativa,
    };
    const noMesAtual = assinaturaAtivaNoMes(info, hoje);

    let status: LinhaAssinatura["status"];
    if (!a.ativa) status = "pausada";
    else if (a.inicio_vigencia > hoje.ultimoDia) status = "futura";
    else if (a.fim_vigencia !== null && a.fim_vigencia < hoje.primeiroDia)
      status = "encerrada";
    else status = "ativa";

    return {
      id: a.id,
      descricao: a.descricao,
      categoria: a.categoria,
      categoriaId: a.categoria_id,
      cartaoId: a.cartao_id,
      cartaoLabel,
      bancoIcone: banco?.icone ?? null,
      bancoCor: banco?.cor ?? "#c67139",
      bancoNome: banco?.nome ?? cartaoLabel,
      valorMensal: Number(a.valor_mensal),
      inicioVigencia: a.inicio_vigencia,
      fimVigencia: a.fim_vigencia,
      status,
      contaNoMes: noMesAtual,
    };
  });

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

  const categoriaIdsPresentes = new Set(
    linhas.map((l) => l.categoriaId).filter((x): x is string => Boolean(x)),
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

      <header>
        <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
          Assinaturas dos cartões
        </h2>
        <p className="mt-1.5 max-w-[64ch] text-[15px] text-neutral-700">
          Todas as assinaturas recorrentes de todos os cartões. Ativas contam
          para o total mensal — pausadas, futuras e encerradas ficam de fora
          do valor mas continuam listadas.
        </p>
      </header>

      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma assinatura registrada em nenhum cartão.
            </p>
          </div>
        </Card>
      ) : (
        <RelatorioAssinaturasClient
          linhas={linhas}
          cartaoOptions={cartaoOptions}
          categoriaOptions={categoriaOptions}
          mesLabel={hoje.label}
        />
      )}
    </div>
  );
}
