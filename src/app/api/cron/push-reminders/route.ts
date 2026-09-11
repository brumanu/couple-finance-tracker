import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { enviarPush, vapidConfigurado } from "@/lib/push/enviar";
import { hojeISO, mesAtual, mesProximo } from "@/lib/mes";
import type {
  CompraCartaoInfo,
  AssinaturaCartaoInfo,
} from "@/lib/cartao-calc";
import { montarLembretes, type ContaParaLembrete } from "@/lib/lembretes";

export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  casal_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type CartaoRow = {
  id: string;
  banco_id: string;
  apelido: string | null;
  dia_fechamento: number;
  dia_vencimento: number;
};

type BancoRow = {
  id: string;
  nome: string;
};

type LancamentoConta = {
  conta_recorrente_id: string | null;
  data_referencia: string;
};

type PagamentoFaturaRow = {
  cartao_id: string;
  mes_referencia: string;
};

// Autorização do cron: fail-closed (sem secret configurado, ninguém entra) e
// comparação em tempo constante.
function cronAutorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const esperado = Buffer.from(`Bearer ${secret}`);
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  if (esperado.length !== recebido.length) return false;
  return timingSafeEqual(esperado, recebido);
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const vapid = vapidConfigurado();
  if (!vapid) {
    return Response.json(
      { ok: false, error: "VAPID não configurado." },
      { status: 500 },
    );
  }

  const supabase = createServiceClient();

  const { data: subsData } = await supabase
    .from("push_subscriptions")
    .select("id, casal_id, endpoint, p256dh, auth");
  const todasSubs = (subsData ?? []) as PushSubscriptionRow[];

  if (todasSubs.length === 0) {
    return Response.json({ ok: true, enviados: 0, limpos: 0 });
  }

  const subsPorCasal = new Map<string, PushSubscriptionRow[]>();
  for (const s of todasSubs) {
    const arr = subsPorCasal.get(s.casal_id) ?? [];
    arr.push(s);
    subsPorCasal.set(s.casal_id, arr);
  }

  const hoje = hojeISO();
  const mesAtualRef = mesAtual();
  const mesSeguinteRef = mesProximo(mesAtualRef);

  let enviados = 0;
  let limpos = 0;
  const idsParaLimpar = new Set<string>();

  for (const [casalId, subs] of subsPorCasal) {
    const [
      contasRes,
      cartoesRes,
      comprasRes,
      assinRes,
      bancosRes,
      lancRes,
      pagFaturasRes,
    ] = await Promise.all([
      supabase
        .from("contas_recorrentes")
        .select(
          "id, descricao, valor_previsto, dia_vencimento, inicio_vigencia, fim_vigencia",
        )
        .eq("casal_id", casalId)
        .eq("ativa", true),
      supabase
        .from("cartoes")
        .select("id, banco_id, apelido, dia_fechamento, dia_vencimento")
        .eq("casal_id", casalId)
        .eq("ativo", true),
      supabase
        .from("compras_cartao")
        .select(
          "id, cartao_id, descricao, valor_total, data_compra, parcelas, parcelas_ja_pagas, categoria",
        )
        .eq("casal_id", casalId),
      supabase
        .from("assinaturas_cartao")
        .select(
          "id, cartao_id, descricao, valor_mensal, categoria, inicio_vigencia, fim_vigencia, ativa",
        )
        .eq("casal_id", casalId)
        .eq("ativa", true),
      supabase.from("bancos").select("id, nome").eq("casal_id", casalId),
      supabase
        .from("lancamentos")
        .select("conta_recorrente_id, data_referencia")
        .eq("casal_id", casalId)
        .eq("tipo", "conta_fixa")
        .gte("data_referencia", mesAtualRef.primeiroDia)
        .lte("data_referencia", mesSeguinteRef.ultimoDia),
      supabase
        .from("pagamentos_fatura")
        .select("cartao_id, mes_referencia")
        .eq("casal_id", casalId)
        .gte("mes_referencia", mesAtualRef.primeiroDia)
        .lte("mes_referencia", mesSeguinteRef.primeiroDia),
    ]);

    const bancos = (bancosRes.data ?? []) as BancoRow[];
    const bancoById = new Map(bancos.map((b) => [b.id, b]));
    const lancamentos = (lancRes.data ?? []) as LancamentoConta[];
    const pagamentosFatura = (pagFaturasRes.data ?? []) as PagamentoFaturaRow[];

    const payloads = montarLembretes(
      {
        contas: (contasRes.data ?? []) as ContaParaLembrete[],
        cartoes: ((cartoesRes.data ?? []) as CartaoRow[]).map((c) => ({
          id: c.id,
          dia_fechamento: c.dia_fechamento,
          dia_vencimento: c.dia_vencimento,
          nome: bancoById.get(c.banco_id)?.nome ?? c.apelido ?? "Cartão",
        })),
        compras: (comprasRes.data ?? []) as CompraCartaoInfo[],
        assinaturas: (assinRes.data ?? []) as AssinaturaCartaoInfo[],
        contasPagas: new Set(
          lancamentos
            .filter((l) => l.conta_recorrente_id)
            .map((l) => `${l.conta_recorrente_id}|${l.data_referencia}`),
        ),
        faturasPagas: new Set(
          pagamentosFatura.map((p) => `${p.cartao_id}|${p.mes_referencia}`),
        ),
      },
      hoje,
    );

    if (payloads.length === 0) continue;

    const resultado = await enviarPush(vapid, subs, payloads);
    enviados += resultado.enviados;
    for (const id of resultado.expiradas) idsParaLimpar.add(id);
  }

  if (idsParaLimpar.size > 0) {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", Array.from(idsParaLimpar));
    if (!error) limpos = idsParaLimpar.size;
  }

  return Response.json({ ok: true, enviados, limpos });
}
