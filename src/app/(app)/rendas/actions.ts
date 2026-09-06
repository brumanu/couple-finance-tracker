"use server";

import { createClient } from "@/lib/supabase/server";
import { campo, opcional, parseForm } from "@/lib/parse-form";
import { primeiroDiaDoMes, ultimoDiaDoMes } from "@/lib/mes";
import {
  clienteAutenticado,
  erroAmigavel,
  revalidar,
  ROTAS_DO_SALDO,
  type EstadoForm,
} from "@/lib/acoes";

export type RendaFormState = EstadoForm;

/**
 * A vigência da renda é escolhida em mês/ano (`<input type="month">`), não em
 * dia: renda fixa entra na quinzena do 15 ou do 30, então o dia de início não
 * significa nada. No banco a coluna é `date`, como nas contas fixas e nas
 * assinaturas — o início vira o primeiro dia do mês e o fim, o último, para
 * que o mês escolhido conte inteiro dos dois lados.
 */
const mesInicial = campo.customizado<string>((bruto) => {
  const dia = primeiroDiaDoMes(bruto);
  if (!dia) return { erro: "Informe o mês em que a renda passa a valer." };
  return { valor: dia };
});

const mesFinal = campo.customizado<string>((bruto) => {
  const dia = ultimoDiaDoMes(bruto);
  if (!dia) return { erro: "Mês de encerramento inválido." };
  return { valor: dia };
});

const ESQUEMA = {
  descricao: campo.texto("Descrição"),
  valor_previsto: campo.dinheiro("Valor"),
  dia_recebimento: campo.umDeNumero("Dia de recebimento", [15, 30] as const),
  inicio_vigencia: mesInicial,
  fim_vigencia: opcional(mesFinal),
  ativa: campo.booleano(),
};

const ROTAS = ["/rendas", ...ROTAS_DO_SALDO];

/** Parse + a única regra que cruza dois campos. */
function lerFormulario(formData: FormData) {
  const dados = parseForm(formData, ESQUEMA);
  if (typeof dados === "string") return dados;
  if (dados.fim_vigencia && dados.fim_vigencia < dados.inicio_vigencia) {
    return "O mês de encerramento não pode ser anterior ao de início.";
  }
  return dados;
}

export async function createRenda(
  _prev: RendaFormState,
  formData: FormData,
): Promise<RendaFormState> {
  const dados = lerFormulario(formData);
  if (typeof dados === "string") return { error: dados };

  const sessao = await clienteAutenticado();
  if ("erro" in sessao) return { error: sessao.erro };

  const { error } = await sessao.supabase.from("rendas").insert(dados);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function updateRenda(
  id: string,
  _prev: RendaFormState,
  formData: FormData,
): Promise<RendaFormState> {
  const dados = lerFormulario(formData);
  if (typeof dados === "string") return { error: dados };

  const supabase = await createClient();
  const { error } = await supabase.from("rendas").update(dados).eq("id", id);
  if (error) return { error: erroAmigavel(error) };

  revalidar(...ROTAS);
  return { ok: true };
}

export async function deleteRenda(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rendas").delete().eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS);
}

export async function toggleRendaAtiva(id: string, ativa: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rendas")
    .update({ ativa })
    .eq("id", id);
  if (error) return { error: erroAmigavel(error) };
  revalidar(...ROTAS);
}
