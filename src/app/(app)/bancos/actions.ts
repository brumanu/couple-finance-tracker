"use server";

import { createClient } from "@/lib/supabase/server";
import { isBancoIconeId } from "@/lib/bancos-icones";
import { campo, parseForm } from "@/lib/parse-form";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  type EstadoForm,
} from "@/lib/acoes";

export type BancoFormState = EstadoForm;

const ESQUEMA = {
  nome: campo.texto("Nome"),
  icone: campo.customizado((bruto) =>
    isBancoIconeId(bruto) ? { valor: bruto } : { erro: "Ícone inválido." },
  ),
};

const ROTAS = ["/bancos", "/cartoes"];

export async function createBanco(
  _prev: BancoFormState,
  formData: FormData,
): Promise<BancoFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  // `casal_id` vem do default da coluna (migration 0014).
  const { error } = await sessao.supabase.from("bancos").insert(dados);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function updateBanco(
  id: string,
  _prev: BancoFormState,
  formData: FormData,
): Promise<BancoFormState> {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return { error: dados };

  const supabase = await createClient();
  const { error } = await supabase.from("bancos").update(dados).eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS, "/");
  return { ok: true };
}

export async function deleteBanco(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("bancos").delete().eq("id", id);
  if (error) {
    return {
      error: erroAmigavel(error, {
        // cartoes.banco_id é on delete restrict.
        "23503": "Exclua ou mova os cartões deste banco antes de excluí-lo.",
      }),
    };
  }
  revalidar(...ROTAS);
}
