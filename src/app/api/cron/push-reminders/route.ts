import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import { hojeISO, buildMes, mesAtual, mesProximo, type MesRef } from "@/lib/mes";
import { formatBRL } from "@/lib/format";
import {
  faturaDoMes,
  type CompraCartaoInfo,
  type AssinaturaCartaoInfo,
} from "@/lib/cartao-calc";

export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  casal_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type ContaRecorrenteRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  dia_vencimento: number | null;
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

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

/**
 * Calcula a próxima ocorrência (a partir de hoje, inclusive) de um dia do
 * mês. Trata meses mais curtos: dia_vencimento=31 num mês de 30 dias cai
 * no último dia daquele mês, não estoura pro mês seguinte.
 */
function proximoVencimento(diaVencimento: number, hoje: Date): Date {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth(); // 0-based

  const ultimoDiaMesAtual = new Date(ano, mes + 1, 0).getDate();
  const diaEsteMes = Math.min(diaVencimento, ultimoDiaMesAtual);
  const candidatoEsteMes = new Date(ano, mes, diaEsteMes);
  if (candidatoEsteMes.getTime() >= hoje.getTime()) return candidatoEsteMes;

  const mesSeguinteIdx = mes + 1;
  const anoSeguinte = ano + Math.floor(mesSeguinteIdx / 12);
  const mesSeguinte = mesSeguinteIdx % 12;
  const ultimoDiaMesSeguinte = new Date(
    anoSeguinte,
    mesSeguinte + 1,
    0,
  ).getDate();
  const diaMesSeguinte = Math.min(diaVencimento, ultimoDiaMesSeguinte);
  return new Date(anoSeguinte, mesSeguinte, diaMesSeguinte);
}

/** Diferença em dias inteiros entre `alvo` e `hoje`, zerando horas. */
function diasAte(alvo: Date, hoje: Date): number {
  const alvoZero = new Date(
    alvo.getFullYear(),
    alvo.getMonth(),
    alvo.getDate(),
  ).getTime();
  const hojeZero = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
  ).getTime();
  return Math.round((alvoZero - hojeZero) / 86_400_000);
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return Response.json(
      { ok: false, error: "VAPID não configurado." },
      { status: 500 },
    );
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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

  const hoje = new Date(hojeISO() + "T00:00:00");
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
    ] = await Promise.all([
      supabase
        .from("contas_recorrentes")
        .select("id, descricao, valor_previsto, dia_vencimento")
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
    ]);

    const contas = (contasRes.data ?? []) as ContaRecorrenteRow[];
    const cartoes = (cartoesRes.data ?? []) as CartaoRow[];
    const compras = (comprasRes.data ?? []) as CompraCartaoInfo[];
    const assinaturas = (assinRes.data ?? []) as AssinaturaCartaoInfo[];
    const bancos = (bancosRes.data ?? []) as BancoRow[];
    const bancoById = new Map(bancos.map((b) => [b.id, b]));
    const lancamentos = (lancRes.data ?? []) as LancamentoConta[];
    const pagoPorContaEData = new Set(
      lancamentos
        .filter((l) => l.conta_recorrente_id)
        .map((l) => `${l.conta_recorrente_id}|${l.data_referencia}`),
    );

    const payloads: PushPayload[] = [];

    for (const conta of contas) {
      if (conta.dia_vencimento == null) continue;
      const proximo = proximoVencimento(conta.dia_vencimento, hoje);
      const dias = diasAte(proximo, hoje);
      if (dias !== 2 && dias !== 1) continue;

      const mesVenc = buildMes(proximo.getFullYear(), proximo.getMonth() + 1);
      const jaPaga = pagoPorContaEData.has(`${conta.id}|${mesVenc.primeiroDia}`);
      if (jaPaga) continue;

      payloads.push({
        title: "Conta perto de vencer",
        body: `${conta.descricao} vence em ${dias} dia(s) — ${formatBRL(conta.valor_previsto)}`,
        url: "/",
      });
    }

    for (const cartao of cartoes) {
      const proximo = proximoVencimento(cartao.dia_vencimento, hoje);
      const dias = diasAte(proximo, hoje);
      if (dias !== 2 && dias !== 1) continue;

      const mesFatura: MesRef = buildMes(
        proximo.getFullYear(),
        proximo.getMonth() + 1,
      );
      const fatura = faturaDoMes(
        {
          id: cartao.id,
          dia_fechamento: cartao.dia_fechamento,
          dia_vencimento: cartao.dia_vencimento,
        },
        compras,
        mesFatura,
        assinaturas,
      );
      if (fatura.total <= 0) continue;

      const banco = bancoById.get(cartao.banco_id);
      const nomeBanco = banco?.nome ?? cartao.apelido ?? "Cartão";

      payloads.push({
        title: `Fatura do cartão vence em ${dias} dia(s)`,
        body: `${nomeBanco}: ${formatBRL(fatura.total)}`,
        url: `/cartoes/${cartao.id}`,
      });
    }

    if (payloads.length === 0) continue;

    const envios = payloads.flatMap((payload) =>
      subs.map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
            {
              vapidDetails: {
                subject: vapidSubject,
                publicKey: vapidPublicKey,
                privateKey: vapidPrivateKey,
              },
            },
          )
          .then(() => {
            enviados += 1;
          })
          .catch((err: unknown) => {
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              idsParaLimpar.add(sub.id);
            }
          }),
      ),
    );

    await Promise.allSettled(envios);
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
