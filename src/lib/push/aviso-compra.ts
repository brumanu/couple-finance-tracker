import { formatBRL } from "@/lib/format";
import type { Notificacao } from "./enviar";

/**
 * Aviso de compra: quando um lança uma compra no cartão ou uma despesa
 * avulsa, os aparelhos do outro recebem um push. Desenho em
 * docs/superpowers/specs/2026-09-11-aviso-de-compra-design.md.
 *
 * Aqui só a parte pura (texto e destinatários); o envio mora em
 * `aviso-compra-server.ts`.
 */

export type CompraLancada =
  | { tipo: "cartao"; cartaoId: string; descricao: string; valor: number }
  | { tipo: "despesa"; descricao: string; valor: number };

export function montarAvisoDeCompra(
  quemLancou: string,
  compra: CompraLancada,
): Notificacao {
  return {
    title: `${quemLancou} lançou`,
    body: `${compra.descricao} — ${formatBRL(compra.valor)}`,
    url: compra.tipo === "cartao" ? `/cartoes/${compra.cartaoId}` : "/despesas",
  };
}

/** Quem lançou não recebe o próprio aviso, em nenhum dos aparelhos. */
export function destinatarios<T extends { profile_id: string }>(
  inscricoesDoCasal: T[],
  quemLancouId: string,
): T[] {
  return inscricoesDoCasal.filter((s) => s.profile_id !== quemLancouId);
}
