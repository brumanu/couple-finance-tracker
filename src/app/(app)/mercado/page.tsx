import type { Metadata } from "next";
import Link from "next/link";
import { HistoryIcon, ShoppingBasketIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCartoesParaSelecao } from "@/lib/cartoes-selection";
import { getCategorias } from "@/lib/categorias-server";
import { getMembrosCasal } from "@/lib/membros-server";
import { Button } from "@/components/ui/button";
import type { ItemMercado } from "@/lib/mercado";
import { ListaCliente } from "./lista-cliente";
import { NovaListaBotao } from "./nova-lista-botao";
import type { PadroesDoFechamento } from "./finalizar-dialog";

export const metadata: Metadata = { title: "Mercado" };

/**
 * Quantos itens do histórico alimentam o autocomplete. Sobe tudo de uma vez
 * pro cliente pra que digitar não vá ao servidor — mil linhas de nome curto
 * são alguns KB, e a tela precisa funcionar com sinal ruim.
 */
const LIMITE_HISTORICO = 1000;

type SupabaseDaPagina = Awaited<ReturnType<typeof createClient>>;

/**
 * Nomes já usados pelo casal, do mais frequente pro menos.
 *
 * A agregação é feita aqui em JS em vez de no banco de propósito: seriam mais
 * uma função SQL e mais uma migration pra ordenar mil linhas curtas que o
 * servidor já tem em memória.
 */
async function getHistoricoDeItens(
  supabase: SupabaseDaPagina,
): Promise<string[]> {
  const { data } = await supabase
    .from("itens_lista_mercado")
    .select("nome")
    .order("created_at", { ascending: false })
    .limit(LIMITE_HISTORICO);

  const frequencia = new Map<string, { nome: string; vezes: number }>();
  for (const { nome } of data ?? []) {
    const chave = nome.toLowerCase();
    const atual = frequencia.get(chave);
    if (atual) atual.vezes++;
    else frequencia.set(chave, { nome, vezes: 1 });
  }

  return [...frequencia.values()]
    .sort((a, b) => b.vezes - a.vezes)
    .map((f) => f.nome);
}

/**
 * Categoria, cartão e "quem gastou" da última compra fechada.
 *
 * Não existe categoria "Mercado" nas seeds — as categorias são criadas pelo
 * usuário — então o fechamento não chuta: ele repete a escolha anterior. A
 * partir da segunda ida o bloco de classificação já vem pronto.
 */
async function getPadroesDoFechamento(
  supabase: SupabaseDaPagina,
): Promise<PadroesDoFechamento> {
  const vazio: PadroesDoFechamento = {
    cartaoId: null,
    categoriaId: null,
    quemGastou: null,
  };

  const { data: ultima } = await supabase
    .from("listas_mercado")
    .select("lancamento_id, compra_cartao_id")
    .eq("status", "finalizada")
    .order("finalizada_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultima) return vazio;

  if (ultima.compra_cartao_id) {
    const { data } = await supabase
      .from("compras_cartao")
      .select("cartao_id, categoria_id, quem_gastou")
      .eq("id", ultima.compra_cartao_id)
      .maybeSingle();
    if (!data) return vazio;
    return {
      cartaoId: data.cartao_id,
      categoriaId: data.categoria_id,
      quemGastou: data.quem_gastou,
    };
  }

  if (ultima.lancamento_id) {
    const { data } = await supabase
      .from("lancamentos")
      .select("categoria_id, quem_gastou")
      .eq("id", ultima.lancamento_id)
      .maybeSingle();
    if (!data) return vazio;
    return {
      cartaoId: null,
      categoriaId: data.categoria_id,
      quemGastou: data.quem_gastou,
    };
  }

  return vazio;
}

export default async function MercadoPage() {
  const supabase = await createClient();

  // O índice único parcial da 0016 garante no máximo uma lista aberta por
  // casal — por isso esta página nunca precisa perguntar "qual lista?".
  const [, listaRes] = await Promise.all([
    requireSession(),
    supabase
      .from("listas_mercado")
      .select("id")
      .eq("status", "aberta")
      .maybeSingle(),
  ]);

  const lista = listaRes.data;

  const cabecalho = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
          Mercado
        </h2>
        <p className="mt-1.5 max-w-[56ch] text-[15px] text-neutral-700">
          Monte a lista em casa, use no corredor. Toque pra marcar o que achou,
          arraste pra esquerda no que faltou.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <Link href="/mercado/historico">
            <HistoryIcon className="size-4" />
            Compras anteriores
          </Link>
        }
      />
    </header>
  );

  if (!lista) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:gap-7 md:p-8">
        {cabecalho}
        <div className="flex flex-col items-center gap-4 rounded-[26px] border border-dashed border-border/70 px-6 py-14 text-center">
          <ShoppingBasketIcon
            className="size-10 text-muted-foreground"
            strokeWidth={1.5}
          />
          <div>
            <p className="font-medium">Nenhuma lista aberta</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie a lista da próxima ida ao mercado.
            </p>
          </div>
          <NovaListaBotao />
        </div>
      </div>
    );
  }

  const [itensRes, historico, cartoes, categorias, membros, padroes] =
    await Promise.all([
      supabase
        .from("itens_lista_mercado")
        .select("id, nome, quantidade, preco, status, faltou_antes, ordem")
        .eq("lista_id", lista.id)
        .order("ordem", { ascending: true }),
      getHistoricoDeItens(supabase),
      getCartoesParaSelecao(),
      getCategorias(),
      getMembrosCasal(),
      getPadroesDoFechamento(supabase),
    ]);

  // `preco` chega como string do `numeric` do Postgres; a tela soma esses
  // valores, então a conversão tem que acontecer antes de sair daqui.
  const itens: ItemMercado[] = (itensRes.data ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    quantidade: i.quantidade,
    preco: i.preco != null ? Number(i.preco) : null,
    status: i.status,
    faltou_antes: i.faltou_antes,
    ordem: i.ordem,
  }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      {cabecalho}
      <ListaCliente
        listaId={lista.id}
        itensIniciais={itens}
        historico={historico}
        cartoes={cartoes}
        categorias={categorias}
        membros={membros}
        padroes={padroes}
      />
    </div>
  );
}
