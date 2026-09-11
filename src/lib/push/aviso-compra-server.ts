import "server-only";
import type { SessaoDaAcao } from "@/lib/acoes";
import { enviarPush, vapidConfigurado } from "./enviar";
import {
  destinatarios,
  montarAvisoDeCompra,
  type CompraLancada,
} from "./aviso-compra";

/**
 * Manda o aviso de compra pros aparelhos do outro. Feito pra rodar dentro de
 * `after()`, depois que a action já respondeu: nunca lança erro, porque a
 * compra já está salva e não há mais tela esperando resposta.
 *
 * Usa o cliente da sessão de quem lançou — a RLS de `push_subscriptions` já
 * restringe a leitura ao casal, então não precisa da chave de serviço.
 */
export async function avisarCompra(
  supabase: SessaoDaAcao,
  quemLancouId: string,
  compra: CompraLancada,
): Promise<void> {
  // Sem VAPID (ambiente local) não há como assinar o push: sai quieto.
  const vapid = vapidConfigurado();
  if (!vapid) return;

  try {
    const [perfilRes, inscricoesRes] = await Promise.all([
      supabase.from("profiles").select("nome").eq("id", quemLancouId).maybeSingle(),
      supabase
        .from("push_subscriptions")
        .select("id, profile_id, endpoint, p256dh, auth"),
    ]);
    if (inscricoesRes.error) throw inscricoesRes.error;

    const alvos = destinatarios(inscricoesRes.data ?? [], quemLancouId);
    if (alvos.length === 0) return;

    const nome = perfilRes.data?.nome?.trim() || "Alguém";
    const { expiradas } = await enviarPush(vapid, alvos, [
      montarAvisoDeCompra(nome, compra),
    ]);

    if (expiradas.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiradas);
    }
  } catch (err) {
    console.error("[aviso-compra] falhou ao enviar", err);
  }
}
