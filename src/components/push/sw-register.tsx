"use client";

import { useEffect } from "react";
import { iniciarColetaDeRecursos } from "@/lib/mercado-offline";

/**
 * Registra o service worker (public/sw.js) assim que o app monta — push,
 * página offline e cópia do Mercado. Não renderiza nada.
 *
 * Também começa a anotar os arquivos do app que o navegador carrega: a cópia
 * do Mercado precisa deles, e só dá pra saber o conjunto completo olhando
 * desde a abertura (ver src/lib/mercado-offline.ts).
 */
export function SwRegister() {
  useEffect(() => {
    iniciarColetaDeRecursos();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registro falhou (ex: navegador sem suporte real) — silencioso,
        // o botão de sino também checa suporte antes de agir.
      });
    }
  }, []);

  return null;
}
