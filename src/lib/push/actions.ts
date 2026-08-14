"use server";

import { createClient } from "@/lib/supabase/server";

export type PushActionState = { error?: string; ok?: boolean };

type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function subscribePush(
  sub: PushSubscriptionInput,
): Promise<PushActionState> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { error: "Inscrição de push inválida." };
  }

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

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      casal_id: profile.casal_id,
      profile_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { error: error.message };

  return { ok: true };
}

export async function unsubscribePush(
  endpoint: string,
): Promise<PushActionState> {
  if (!endpoint) return { error: "Endpoint inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) return { error: error.message };

  return { ok: true };
}
