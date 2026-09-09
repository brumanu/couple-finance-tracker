import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { MesRef } from "@/lib/mes";
import type { ExtraDeCategoria } from "@/lib/categorias-extras";

/**
 * As cinco consultas que todo relatório de gasto mensal faz.
 *
 * Sete relatórios repetiam este bloco inteiro: os mesmos cinco `select`, os
 * mesmos filtros de vigência, o mesmo recorte de 60 meses pras compras — e
 * cada um com a sua cópia dos cinco `type ...Row`. Além do tamanho, isso
 * criava uma classe inteira de bug: bastava um relatório esquecer uma coluna
 * no `select` pra ele calcular diferente dos outros sem ninguém perceber.
 * Foi o que aconteceu com `dia_vencimento` na revisão de setembro, quando o
 * mês da fatura passou a depender dele.
 *
 * Aqui os `select` são constantes e as linhas têm um tipo só. Como o custo
 * de trazer uma coluna a mais é irrelevante nesta escala, o conjunto é a
 * união do que os relatórios usam — assim ninguém precisa lembrar de
 * acrescentar coluna ao adicionar um campo numa tela.
 *
 * As categorias extras (migration 0017) vêm embutidas, não numa consulta à
 * parte: existe FK de `categorias_extras` pras duas tabelas, então o
 * PostgREST resolve o join sozinho e o custo é um left join numa tabela que
 * só tem linha pra lançamento que ganhou categoria adicional. Uma segunda ida
 * ao banco sairia mais cara do que isso, e teria que ser em série — os ids só
 * existem depois da primeira.
 *
 * Só cobre os relatórios de UM mês com filtro de vigência. `fluxo-mensal`,
 * `categoria-por-mes`, `renda-x-despesa` e `comprometimento-futuro` varrem
 * faixas de vários meses com recortes próprios e continuam com as suas
 * consultas.
 */

const COLUNAS_LANCAMENTOS =
  "id, tipo, descricao, valor, data_referencia, data_pagamento, quinzena, categoria, categoria_id, conta_recorrente_id, quem_gastou, categorias_extras(categoria_id)";

const COLUNAS_CONTAS =
  "id, descricao, valor_previsto, quinzena, dia_vencimento, categoria, categoria_id, inicio_vigencia, fim_vigencia, ativa, quem_gastou";

const COLUNAS_COMPRAS =
  "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria, categoria_id, quem_gastou, categorias_extras(categoria_id)";

const COLUNAS_ASSINATURAS =
  "id, cartao_id, descricao, valor_mensal, categoria, categoria_id, inicio_vigencia, fim_vigencia, ativa, quem_gastou";

const COLUNAS_CARTOES =
  "id, banco_id, apelido, dia_fechamento, dia_vencimento";

export type LancamentoDoMes = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number | string;
  data_referencia: string;
  data_pagamento: string | null;
  quinzena: number | null;
  categoria: string | null;
  categoria_id: string | null;
  categorias_extras: ExtraDeCategoria[] | null;
  conta_recorrente_id: string | null;
  quem_gastou: string | null;
};

export type ContaDoMes = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  // `not null` no schema, ao contrário da quinzena de `lancamentos`.
  quinzena: number;
  dia_vencimento: number | null;
  categoria: string | null;
  categoria_id: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
  quem_gastou: string | null;
};

export type CompraDoMes = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number | null;
  categoria: string | null;
  categoria_id: string | null;
  categorias_extras: ExtraDeCategoria[] | null;
  quem_gastou: string | null;
};

export type AssinaturaDoMes = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
  categoria: string | null;
  categoria_id: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
  quem_gastou: string | null;
};

export type CartaoDoMes = {
  id: string;
  banco_id: string;
  apelido: string | null;
  dia_fechamento: number;
  dia_vencimento: number;
};

/**
 * Data a partir da qual uma compra ainda pode ter parcela viva no mês alvo.
 *
 * 60 é o máximo de parcelas que o formulário aceita, então nada comprado
 * antes disso alcança `mes`. Sem esse corte, todo relatório varreria a tabela
 * de compras inteira.
 */
export function cutoffDeCompras(mes: MesRef): string {
  const d = new Date(mes.ano, mes.mes - 1 - 60, 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-01`;
}

export type DadosDoMes = {
  lancamentos: LancamentoDoMes[];
  contas: ContaDoMes[];
  compras: CompraDoMes[];
  assinaturas: AssinaturaDoMes[];
  cartoes: CartaoDoMes[];
};

/**
 * `React.cache` memoiza por request: dois componentes do mesmo render que
 * peçam o mesmo mês fazem uma ida só ao banco.
 */
export const dadosDoMes = cache(async (mes: MesRef): Promise<DadosDoMes> => {
  const supabase = await createClient();

  const [lancRes, contasRes, comprasRes, assinRes, cartoesRes] =
    await Promise.all([
      supabase
        .from("lancamentos")
        .select(COLUNAS_LANCAMENTOS)
        .in("tipo", ["despesa_avulsa", "conta_fixa"])
        .gte("data_referencia", mes.primeiroDia)
        .lte("data_referencia", mes.ultimoDia),
      supabase
        .from("contas_recorrentes")
        .select(COLUNAS_CONTAS)
        .eq("ativa", true)
        .lte("inicio_vigencia", mes.ultimoDia)
        .or(`fim_vigencia.is.null,fim_vigencia.gte.${mes.primeiroDia}`),
      supabase
        .from("compras_cartao")
        .select(COLUNAS_COMPRAS)
        .gte("data_compra", cutoffDeCompras(mes))
        .lte("data_compra", mes.ultimoDia),
      supabase
        .from("assinaturas_cartao")
        .select(COLUNAS_ASSINATURAS)
        .eq("ativa", true),
      supabase.from("cartoes").select(COLUNAS_CARTOES),
    ]);

  return {
    lancamentos: (lancRes.data ?? []) as unknown as LancamentoDoMes[],
    contas: (contasRes.data ?? []) as unknown as ContaDoMes[],
    compras: (comprasRes.data ?? []) as unknown as CompraDoMes[],
    assinaturas: (assinRes.data ?? []) as unknown as AssinaturaDoMes[],
    cartoes: (cartoesRes.data ?? []) as unknown as CartaoDoMes[],
  };
});
