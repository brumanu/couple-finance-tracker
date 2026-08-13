"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CategoriaFormState = { error?: string; ok?: boolean };

type Parsed = {
  nome: string;
  cor: string;
  emoji: string | null;
};

function parseFormData(formData: FormData): Parsed | string {
  const nome = String(formData.get("nome") ?? "").trim();
  const cor = String(formData.get("cor") ?? "").trim() || "#c67139";
  const emojiRaw = String(formData.get("emoji") ?? "").trim();
  const emoji = emojiRaw ? emojiRaw : null;

  if (!nome) return "Nome é obrigatório.";
  if (nome.length > 60) return "Nome muito longo (máx 60).";
  if (!/^#[0-9a-fA-F]{6}$/.test(cor)) return "Cor inválida.";
  if (emoji && emoji.length > 8) return "Emoji muito longo.";

  return { nome, cor, emoji };
}

async function revalidaTudoQueUsa() {
  // categorias podem aparecer em quase todas as telas — invalida por segurança
  revalidatePath("/categorias");
  revalidatePath("/despesas");
  revalidatePath("/recorrentes");
  revalidatePath("/cartoes");
  revalidatePath("/");
}

export async function createCategoria(
  _prev: CategoriaFormState,
  formData: FormData,
): Promise<CategoriaFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("casal_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Profile não encontrado." };

  const { error } = await supabase.from("categorias").insert({
    casal_id: profile.casal_id,
    ...parsed,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `Já existe uma categoria "${parsed.nome}".` };
    return { error: error.message };
  }

  await revalidaTudoQueUsa();
  return { ok: true };
}

export async function updateCategoria(
  id: string,
  _prev: CategoriaFormState,
  formData: FormData,
): Promise<CategoriaFormState> {
  const parsed = parseFormData(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("casal_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Profile não encontrado." };

  const { error } = await supabase
    .from("categorias")
    .update(parsed)
    .eq("id", id);
  if (error) {
    if (error.code === "23505")
      return { error: `Já existe uma categoria "${parsed.nome}".` };
    return { error: error.message };
  }

  // se o nome mudou, sincroniza o texto legado nas 4 tabelas que ainda o mostram
  await supabase
    .from("contas_recorrentes")
    .update({ categoria: parsed.nome })
    .eq("categoria_id", id)
    .eq("casal_id", profile.casal_id);
  await supabase
    .from("lancamentos")
    .update({ categoria: parsed.nome })
    .eq("categoria_id", id)
    .eq("casal_id", profile.casal_id);
  await supabase
    .from("compras_cartao")
    .update({ categoria: parsed.nome })
    .eq("categoria_id", id)
    .eq("casal_id", profile.casal_id);
  await supabase
    .from("assinaturas_cartao")
    .update({ categoria: parsed.nome })
    .eq("categoria_id", id)
    .eq("casal_id", profile.casal_id);

  await revalidaTudoQueUsa();
  return { ok: true };
}

export async function deleteCategoria(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("casal_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Profile não encontrado." };

  // FK on delete set null → registros perdem o categoria_id
  // O texto legado (categoria text) fica; limpamos pra consistência.
  await supabase
    .from("contas_recorrentes")
    .update({ categoria: null })
    .eq("categoria_id", id)
    .eq("casal_id", profile.casal_id);
  await supabase
    .from("lancamentos")
    .update({ categoria: null })
    .eq("categoria_id", id)
    .eq("casal_id", profile.casal_id);
  await supabase
    .from("compras_cartao")
    .update({ categoria: null })
    .eq("categoria_id", id)
    .eq("casal_id", profile.casal_id);
  await supabase
    .from("assinaturas_cartao")
    .update({ categoria: null })
    .eq("categoria_id", id)
    .eq("casal_id", profile.casal_id);

  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) return { error: error.message };
  await revalidaTudoQueUsa();
}
