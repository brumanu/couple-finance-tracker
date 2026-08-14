"use client";

import { useEffect } from "react";

/**
 * Registra o service worker de push (public/sw.js) assim que o app monta.
 * Não renderiza nada — só efeito colateral.
 */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registro falhou (ex: navegador sem suporte real) — silencioso,
        // o botão de sino também checa suporte antes de agir.
      });
    }
  }, []);

  return null;
}
