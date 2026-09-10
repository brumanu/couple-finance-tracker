"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudOffIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  copiaOfflineSalvaEm,
  guardarCopiaDoMercado,
} from "@/lib/mercado-offline";

/** De quanto em quanto tempo a cópia testa se o servidor voltou. */
const TESTE_CONEXAO_MS = 10_000;

// A marca no <html> é posta pelo service worker antes da página existir e
// não muda depois — não há o que assinar.
const semAssinatura = () => () => {};

/**
 * Dois papéis, conforme a página seja a de verdade ou a cópia offline:
 *
 * - de verdade: pede ao service worker uma cópia nova de /mercado. `chave`
 *   é o id da lista (ou "sem-lista"): mudou a lista — nova, finalizada —,
 *   a cópia é refeita, pra não sobrar no aparelho uma lista que já fechou.
 * - cópia: avisa que é a lista salva e de quando, e recarrega a página
 *   assim que o servidor responder. Recarregar ANTES de enviar a fila é o
 *   que protege contra deploy no meio: a cópia pode ser de uma versão
 *   anterior do app, cujas server actions o servidor já não reconhece. A
 *   página nova adota a fila do localStorage e envia com a versão atual.
 */
export function CopiaOffline({ chave }: { chave: string }) {
  const salvaEm = useSyncExternalStore(
    semAssinatura,
    copiaOfflineSalvaEm,
    () => null,
  );

  useEffect(() => {
    if (salvaEm) return;
    guardarCopiaDoMercado();

    // Primeira abertura depois de um deploy: o pedido acima vai pro service
    // worker antigo, que não sabe guardar cópia, e o novo assume logo em
    // seguida. Quando ele assume, o pedido é refeito.
    const sw = navigator.serviceWorker;
    sw?.addEventListener("controllerchange", guardarCopiaDoMercado);
    return () => sw?.removeEventListener("controllerchange", guardarCopiaDoMercado);
  }, [chave, salvaEm]);

  const [testando, setTestando] = useState(false);

  useEffect(() => {
    if (!salvaEm) return;

    async function testar() {
      if (await servidorResponde()) window.location.reload();
    }

    const intervalo = setInterval(testar, TESTE_CONEXAO_MS);
    window.addEventListener("online", testar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("online", testar);
    };
  }, [salvaEm]);

  if (!salvaEm) return null;

  async function tentarAgora() {
    setTestando(true);
    const voltou = await servidorResponde();
    if (voltou) {
      window.location.reload();
      return;
    }
    setTestando(false);
    toast.error("Ainda sem conexão com o servidor.");
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface-soft px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4"
    >
      <CloudOffIcon
        className="hidden size-5 shrink-0 text-neutral-700 sm:block"
        strokeWidth={2.25}
      />
      <p className="flex-1 text-sm text-neutral-800">
        <span className="font-semibold">Sem conexão.</span> Esta é a lista
        salva {formatarQuando(salvaEm)}. O que você marcar fica guardado no
        celular e é enviado quando o sinal voltar.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={tentarAgora}
        disabled={testando}
        className="self-start sm:self-auto"
      >
        {testando && <LoaderCircleIcon className="size-4 animate-spin" />}
        Tentar conectar
      </Button>
    </div>
  );
}

/**
 * Testa o servidor, não o `navigator.onLine`: no mercado o celular costuma
 * dizer que está conectado sem conseguir carregar nada. O offline.html é o
 * arquivo mais leve que o app serve, e não passa pelo service worker.
 */
async function servidorResponde(): Promise<boolean> {
  try {
    const r = await fetch("/offline.html", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function formatarQuando(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "antes";
  const hora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const hoje = new Date();
  if (data.toDateString() === hoje.toDateString()) return `às ${hora}`;
  const dia = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  return `em ${dia} às ${hora}`;
}
