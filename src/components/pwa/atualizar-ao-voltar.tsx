"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Trocar de app pra responder uma mensagem e voltar não deve disparar nada;
// ficar fora tempo suficiente pro outro celular ter lançado algo, sim.
const AUSENCIA_MINIMA_MS = 30_000;

/**
 * Atualiza os dados da tela quando o app volta pro primeiro plano.
 *
 * Instalado, o app não recarrega ao ser reaberto: o sistema só o tira da
 * suspensão, com a página do jeito que estava. Se a outra pessoa lançou uma
 * despesa nesse meio-tempo, os números na tela estão velhos e não há barra
 * de endereço nem botão de recarregar pra resolver.
 *
 * `router.refresh()` busca de novo só os server components; estado de
 * cliente (formulário aberto, texto digitado) fica intacto.
 */
export function AtualizarAoVoltar() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // O mercado tem o próprio tratamento: antes de buscar, ele precisa subir
    // a fila de alterações feitas sem conexão (lista-cliente.tsx).
    if (pathname.startsWith("/mercado")) return;

    let saiuEm: number | null = null;

    function aoMudarVisibilidade() {
      if (document.visibilityState === "hidden") {
        saiuEm = Date.now();
        return;
      }
      if (saiuEm !== null && Date.now() - saiuEm >= AUSENCIA_MINIMA_MS) {
        router.refresh();
      }
      saiuEm = null;
    }

    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [pathname, router]);

  return null;
}
