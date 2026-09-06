"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  type EstadoForm,
  type SessaoDaAcao,
} from "@/lib/acoes";

export type CategoriaFormState = EstadoForm;

const ESQUEMA = {
  nome: campo.texto("Nome", { max: 60 }),
  cor: campo.customizado((bruto) => {
    const cor = bruto || "#c67139";
    return /^#[0-9a-fA-F]{6}$/.test(cor)
      ? { valor: cor }
      : { erro: "Cor inválida." };
  }),
  emoji: campo.customizado((bruto) => {
    if (!bruto) return { valor: null as string | null };
    return bruto.length > 8
      ? { erro: "Emoji muito longo." }
      : { valor: bruto as string | null };
  }),
};

// Categorias aparecem em quase toda tela — invalida geral por segurança.
const ROTAS = ["/categorias", "/despesas", "/recorrentes", "/cartoes", "/"];

/**
 * Tabelas que ainda guardam o NOME da categoria em texto, além do FK.
 * Renomear ou excluir uma categoria precisa acertar as quatro.
 */
const TABELAS_COM_TEXTO_LEGADO = [
  "contas_recorrentes",
  "lancamentos",
  "compras_cartao",
  "assinaturas_cartao",
] as const;

/**
 * Propaga o texto legado. As quatro tabelas são independentes, então vão
 * juntas — antes eram quatro `await` em fila.
 *
 * Não filtra por `casal_id`: a RLS já restringe cada update ao casal do
 * usuário, então o filtro extra que existia aqui só custava uma busca a mais
 * do `casal_id` no `profiles`.
 */
async function propagarNome(
  supabase: SessaoDaAcao,
  categoriaId: string,
  nome: string | null,
) {
  await Promise.all(
    TABELAS_COM_TEXTO_LEGADO.map((tabela) =>
      supabase
        .from(tabela)
        .update({ categoria: nome })
        .eq("categoria_id", categoriaId),
    ),
  );
}

export async function createCategoria(
  _prev: CategoriaFormState,
  formData: FormData,
): Promise<CategoriaFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const { error } = await sessao.supabase.from("categorias").insert(dados);
  if (error) {
    return {
      error: erroAmigavel(error, {
        "23505": `Já existe uma categoria "${dados.nome}".`,
      }),
    };
  }

  revalidar(...ROTAS);
  return { ok: true };
}

export async function updateCategoria(
  id: string,
  _prev: CategoriaFormState,
  formData: FormData,
): Promise<CategoriaFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const supabase = await createClient();
  const { error } = await supabase.from("categorias").update(dados).eq("id", id);
  if (error) {
    return {
      error: erroAmigavel(error, {
        "23505": `Já existe uma categoria "${dados.nome}".`,
      }),
    };
  }

  await propagarNome(supabase, id, dados.nome);

  revalidar(...ROTAS);
  return { ok: true };
}

export async function deleteCategoria(id: string) {
  const supabase = await createClient();

  // A FK é `on delete set null`, então o categoria_id se resolve sozinho.
  // O texto legado não — limpamos antes pra não sobrar nome de categoria
  // que já não existe.
  await propagarNome(supabase, id, null);

  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS);
}
