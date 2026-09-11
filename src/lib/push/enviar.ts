import "server-only";
import webpush from "web-push";

/**
 * Envio de Web Push, usado pelo cron de vencimentos e pelo aviso de compra.
 *
 * Não apaga nada: devolve os ids das inscrições que o serviço de push
 * (Apple/Google/Mozilla) disse não existirem mais, e quem chamou apaga com o
 * cliente que tiver — o cron com o de serviço, a action com o da sessão.
 */

export type InscricaoPush = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type Notificacao = {
  title: string;
  body: string;
  url: string;
};

type Vapid = { subject: string; publicKey: string; privateKey: string };

/** As três variáveis VAPID, ou `null` se faltar alguma (ex.: ambiente local). */
export function vapidConfigurado(): Vapid | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { subject, publicKey, privateKey };
}

export async function enviarPush(
  vapid: Vapid,
  inscricoes: InscricaoPush[],
  notificacoes: Notificacao[],
): Promise<{ enviados: number; expiradas: string[] }> {
  let enviados = 0;
  const expiradas = new Set<string>();

  await Promise.allSettled(
    notificacoes.flatMap((notificacao) =>
      inscricoes.map((sub) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(notificacao),
            { vapidDetails: vapid },
          )
          .then(() => {
            enviados += 1;
          })
          .catch((err: unknown) => {
            // 404/410: o aparelho desinstalou o app ou revogou a permissão.
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) expiradas.add(sub.id);
          }),
      ),
    ),
  );

  return { enviados, expiradas: [...expiradas] };
}
