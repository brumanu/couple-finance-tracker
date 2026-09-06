import { cache } from "react";
import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolverCategoria } from "@/lib/categorias-server";
import { resolverQuemGastou } from "@/lib/membros-server";

/**
 * Peças comuns das Server Actions.
 *
 * Este arquivo **não** leva `"use server"`: um módulo com essa diretiva só
 * pode exportar funções async (viram endpoints). Aqui tem tipo, constante e
 * função síncrona, então ele é um módulo normal — importado apenas pelos
 * arquivos de action, que são os que carregam a diretiva.
 */

/** Formato de retorno de toda action de formulário. */
export type EstadoForm = { error?: string; ok?: boolean };

export type SessaoDaAcao = Awaited<ReturnType<typeof createClient>>;

/**
 * Cliente Supabase + id do usuário, com o check de autenticação já feito.
 *
 * Substitui o bloco de 12 linhas que estava copiado em 13 arquivos de action
 * (`getUser()` → `profiles.select("casal_id")` → dois `if`). Duas mudanças
 * em relação a ele:
 *
 * 1. Usa `getClaims()`, que valida o JWT localmente contra o JWKS, em vez de
 *    `getUser()`, que faz round-trip pro Auth server. Mesma estratégia do
 *    `requireSession()` e do proxy.
 * 2. Não busca mais o `casal_id`. A partir da migration 0014 as colunas
 *    `casal_id` e `criado_por` têm default no banco
 *    (`current_casal_id()` e `auth.uid()`), então o insert não precisa
 *    mandá-las — e o `with check` da RLS continua sendo quem valida.
 *
 * Resultado: uma ida ao banco a menos por cadastro.
 *
 * O `cache()` do React memoiza por request, então chamar isso em duas actions
 * do mesmo POST não repete trabalho.
 */
export const clienteAutenticado = cache(
  async (): Promise<
    { supabase: SessaoDaAcao; userId: string } | { erro: string }
  > => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data) return { erro: "Não autenticado." };
    return { supabase, userId: data.claims.sub };
  },
);

/**
 * Traduz erro do Postgres pra frase que o usuário entende.
 *
 * Os códigos tratados aqui aparecem de verdade neste app:
 * - `23505` unique — conta já paga no mês, categoria repetida, fatura já paga.
 * - `23503` foreign key — excluir banco que ainda tem cartão.
 * - `23514` check — a trigger `assert_mesmo_casal()` da migration 0013.
 *
 * Sem correspondência, devolve a mensagem do Postgres como antes.
 */
export function erroAmigavel(
  error: PostgrestError,
  mensagens?: Partial<Record<"23505" | "23503" | "23514", string>>,
): string {
  const especifica = mensagens?.[error.code as keyof typeof mensagens];
  if (especifica) return especifica;

  if (error.code === "23514" && error.message.includes("outro casal")) {
    return "Esse registro pertence a outro casal.";
  }

  // 42501 num INSERT quase sempre significa que a migration 0014 não rodou:
  // sem o default, `casal_id` chega nulo e o `with check` da RLS barra. A
  // mensagem crua do Postgres ("violates row-level security policy") manda
  // procurar no lugar errado.
  if (error.code === "42501" && error.message.includes("row-level security")) {
    return "Não foi possível salvar: o banco de dados está desatualizado (falta a migration 0014).";
  }

  return error.message;
}

/**
 * Invalida as rotas afetadas por uma mutação.
 *
 * Só existe pra encurtar as sequências de 3–4 `revalidatePath` seguidos que
 * aparecem em toda action, e pra deixar a lista de rotas visível numa linha só
 * quando alguém for conferir se esqueceu alguma.
 */
export function revalidar(...rotas: string[]): void {
  for (const rota of rotas) revalidatePath(rota);
}

/**
 * Rotas que dependem do saldo/sobra do mês e por isso precisam ser
 * revalidadas por praticamente qualquer lançamento.
 */
export const ROTAS_DO_SALDO = [
  "/",
  "/relatorios/fluxo-mensal",
  "/relatorios/renda-x-despesa",
] as const;

/**
 * Resolve categoria e "quem gastou" de uma vez.
 *
 * As duas validações são independentes, mas as sete actions que precisavam
 * das duas faziam `await` em sequência — duas idas ao banco enfileiradas sem
 * motivo. Aqui elas saem juntas.
 *
 * Mantém a convenção de erro dos resolvers originais: `string` com a
 * mensagem, e a da categoria tem prioridade por ser o campo que aparece
 * primeiro no formulário.
 */
export async function resolverClassificacao(
  supabase: SessaoDaAcao,
  categoriaBruta: string,
  quemBruto: string,
): Promise<
  { categoria_id: string | null; categoria: string | null; quem_gastou: string | null } | string
> {
  const [categoria, quem] = await Promise.all([
    resolverCategoria(supabase, categoriaBruta),
    resolverQuemGastou(supabase, quemBruto),
  ]);
  if (typeof categoria === "string") return categoria;
  if (typeof quem === "string") return quem;
  return { ...categoria, ...quem };
}
