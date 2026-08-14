"use client";

import { useEffect, useState } from "react";
import { BellIcon, BellOffIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { subscribePush, unsubscribePush } from "@/lib/push/actions";

type Props = {
  className?: string;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushToggleButton({ className }: Props) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }
      if (cancelled) return;
      setSupported(true);
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch {
        // ignora — fica no estado "não inscrito"
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!supported) return null;

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } finally {
      setBusy(false);
    }
  }

  async function subscribe() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Notificações bloqueadas pelo navegador.");
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast.error("Configuração de notificações ausente.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const result = await subscribePush(
        sub.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        },
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setSubscribed(true);
      toast.success("Lembretes ativados.");
    } catch {
      toast.error("Não foi possível ativar os lembretes.");
    }
  }

  async function unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const result = await unsubscribePush(endpoint);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
      }
      setSubscribed(false);
      toast.success("Lembretes desativados.");
    } catch {
      toast.error("Não foi possível desativar os lembretes.");
    }
  }

  const Icon = subscribed ? BellIcon : BellOffIcon;
  const label = subscribed ? "Desativar lembretes" : "Ativar lembretes";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2.75} />
    </button>
  );
}
