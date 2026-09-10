// Service worker do app. Arquivo JS puro — servido como está pela pasta
// public/, NÃO passa pelo bundler do Next.
//
// Faz duas coisas: notificação push e a página "Sem conexão". De propósito
// NÃO guarda páginas nem dados em cache: número financeiro velho mostrado
// como se fosse atual é pior que uma tela dizendo que falta internet.

const CACHE_OFFLINE = "offline-v1";
const PAGINA_OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_OFFLINE)
      .then((cache) => cache.add(new Request(PAGINA_OFFLINE, { cache: "reload" })))
      // Não há cache de página pra ficar inconsistente entre versões, então a
      // versão nova pode assumir na hora, sem esperar todas as abas fecharem.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => n !== CACHE_OFFLINE).map((n) => caches.delete(n)),
      );
      // Com um handler de fetch, toda navegação esperaria o service worker
      // acordar antes de ir pra rede. O preload dispara a requisição em
      // paralelo com o boot dele.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Só a abertura de páginas. RSC, server actions, JS e imagens seguem direto
  // pra rede sem passar por aqui.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) return preload;
        return await fetch(event.request);
      } catch {
        const offline = await caches.match(PAGINA_OFFLINE);
        return offline || Response.error();
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Financeiro", {
      body: data.body || "",
      icon: "/icon",
      badge: "/icon",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Com o app já aberto, reaproveita a janela e leva ela pro destino —
      // antes ela só ganhava foco e ficava na tela em que estava.
      const janela = janelas.find((c) => c.url === destino) || janelas[0];
      if (janela) {
        const focada = await janela.focus();
        if (janela.url !== destino && "navigate" in focada) {
          try {
            return await focada.navigate(destino);
          } catch {
            // Janela que o service worker não controla recusa navigate().
          }
        } else {
          return focada;
        }
      }
      return self.clients.openWindow(destino);
    })(),
  );
});
