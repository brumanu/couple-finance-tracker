/**
 * Cópia do Mercado pra abrir sem internet — lado da página.
 *
 * Quem guarda e serve a cópia é o service worker (public/sw.js); aqui ficam
 * os pedidos que a página faz a ele. Desenho completo em
 * docs/superpowers/specs/2026-09-10-mercado-offline-design.md.
 *
 * O sw.js é JS puro servido de public/, sem bundler, então não importa daqui:
 * os nomes abaixo estão repetidos lá. Mudou um, mude o outro.
 */

export const CACHE_MERCADO = "mercado-offline";

/** Intervalo mínimo entre duas cópias: cada uma re-renderiza /mercado. */
const INTERVALO_MINIMO_MS = 15_000;

// ------------------------------------------------------------------
// Arquivos do app que a página já carregou
// ------------------------------------------------------------------

// O HTML de /mercado lista os scripts da primeira pintura, mas não as fontes
// (vêm do CSS) nem o que carrega depois. Quem sabe o conjunto completo é o
// navegador: o PerformanceObserver anota tudo de /_next/static que passar,
// desde a abertura do app — sem o limite de 250 entradas do buffer de
// performance, que numa sessão longa enche e para de anotar.
const recursos = new Set<string>();
let coletando = false;

export function iniciarColetaDeRecursos(): void {
  if (coletando || typeof PerformanceObserver === "undefined") return;
  coletando = true;
  try {
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) {
        try {
          const url = new URL(entrada.name);
          if (
            url.origin === location.origin &&
            url.pathname.startsWith("/_next/static/")
          ) {
            recursos.add(url.pathname + url.search);
          }
        } catch {
          // Entrada com nome que não é URL — ignora.
        }
      }
    }).observe({ type: "resource", buffered: true });
  } catch {
    // Navegador sem suporte a `type` no observe — a cópia fica só com o que
    // o HTML referencia.
  }
}

// ------------------------------------------------------------------
// Pedidos ao service worker
// ------------------------------------------------------------------

let ultimoPedido = 0;
let pedidoAgendado: ReturnType<typeof setTimeout> | null = null;

/**
 * Pede ao service worker uma cópia nova de /mercado. Chamada quando a tela
 * abre e depois de cada envio da fila, pra cópia bater com o servidor.
 *
 * Vários pedidos em sequência viram um só a cada 15s, sempre o último — o
 * service worker busca a página na hora de guardar, então o último pedido é
 * o que tem o estado mais novo.
 */
export function guardarCopiaDoMercado(): void {
  if (copiaOfflineSalvaEm()) return; // a própria cópia não se recopia
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return;

  const espera = ultimoPedido + INTERVALO_MINIMO_MS - Date.now();
  if (espera > 0) {
    pedidoAgendado ??= setTimeout(() => {
      pedidoAgendado = null;
      guardarCopiaDoMercado();
    }, espera);
    return;
  }

  ultimoPedido = Date.now();
  sw.postMessage({ tipo: "guardar-mercado", recursos: [...recursos] });
}

/**
 * Apaga a cópia — ao sair da conta, e na tela de login (sessão expirada).
 * A cópia tem a lista e o nome do casal; não pode sobrar num aparelho
 * deslogado.
 *
 * Apaga direto e também avisa o service worker: se ele estiver no meio de
 * uma cópia, a limpeza entra na fila dele e acontece depois, em vez de a
 * cópia ser gravada por cima da limpeza.
 */
export function limparCopiaDoMercado(): void {
  if (pedidoAgendado) {
    clearTimeout(pedidoAgendado);
    pedidoAgendado = null;
  }
  navigator.serviceWorker?.controller?.postMessage({ tipo: "limpar-mercado" });
  if (typeof caches !== "undefined") {
    caches.delete(CACHE_MERCADO).catch(() => {});
  }
}

// ------------------------------------------------------------------
// A página atual é a cópia?
// ------------------------------------------------------------------

/**
 * Quando serve a cópia, o service worker marca `<html data-copia-offline>`
 * com a hora em que ela foi salva (o layout raiz tem suppressHydrationWarning
 * no <html>, então a marca sobrevive à hidratação). `null` = página de verdade.
 */
export function copiaOfflineSalvaEm(): string | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.dataset.copiaOffline ?? null;
}
