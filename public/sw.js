// Service worker do app. Arquivo JS puro — servido como está pela pasta
// public/, NÃO passa pelo bundler do Next.
//
// Faz três coisas: notificação push, a página "Sem conexão" e a cópia do
// Mercado pra abrir sem sinal. Fora o Mercado, nenhuma página nem dado vai
// pro cache: número financeiro velho mostrado como atual é pior que uma tela
// dizendo que falta internet. O Mercado é a exceção porque é usado justamente
// onde o sinal some, e a tela avisa que é uma cópia (ver
// docs/superpowers/specs/2026-09-10-mercado-offline-design.md).

const CACHE_OFFLINE = "offline-v1";
const PAGINA_OFFLINE = "/offline.html";

// Repetidos em src/lib/mercado-offline.ts — mudou aqui, mude lá.
const CACHE_MERCADO = "mercado-offline";
const URL_MERCADO = "/mercado";
const HEADER_COPIA_EM = "x-copia-em";

// Com a cópia guardada, esperar mais que isso pela rede é pior que abrir a
// cópia: sinal de mercado costuma ser o que "conecta" mas não carrega nada.
const ESPERA_REDE_MERCADO_MS = 5000;

const CACHES_DO_APP = [CACHE_OFFLINE, CACHE_MERCADO];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_OFFLINE)
      .then((cache) => cache.add(new Request(PAGINA_OFFLINE, { cache: "reload" })))
      // Nada em cache depende da versão do service worker (a cópia do
      // Mercado carrega os próprios arquivos), então a versão nova pode
      // assumir na hora, sem esperar todas as abas fecharem.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => !CACHES_DO_APP.includes(n)).map((n) => caches.delete(n)),
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

// ------------------------------------------------------------------
// Requisições
// ------------------------------------------------------------------

// Abas que abriram a cópia do Mercado. Pra elas os arquivos do app vêm do
// cache primeiro — sem sinal, cada arquivo esperando a rede falhar deixaria
// a cópia minutos sem responder. Pras outras abas a rede vem primeiro: em
// desenvolvimento o mesmo endereço muda de conteúdo a cada edição, e cache
// primeiro serviria código velho. Se o service worker for reiniciado o Set
// se perde e a cópia cai no "rede primeiro", que continua funcionando.
const abasNaCopia = new Set();

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(abrirPagina(event));
    return;
  }

  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(arquivoDoApp(request, abasNaCopia.has(event.clientId)));
  }
  // Todo o resto (RSC, server actions, imagens, API) segue direto pra rede.
});

async function abrirPagina(event) {
  const url = new URL(event.request.url);
  const rede = (async () => {
    const preload = await event.preloadResponse;
    return preload || fetch(event.request);
  })();

  if (url.pathname === URL_MERCADO) {
    const copia = await caches.match(URL_MERCADO, { cacheName: CACHE_MERCADO });
    if (copia) {
      const tempo = new Promise((resolve) =>
        setTimeout(() => resolve(null), ESPERA_REDE_MERCADO_MS),
      );
      const resposta = await Promise.race([rede.catch(() => null), tempo]);
      // Servidor fora do ar (5xx) também cai na cópia: é o mesmo "sem
      // acesso à lista" do ponto de vista de quem está no corredor.
      if (resposta && resposta.status < 500) return resposta;
      if (event.resultingClientId) abasNaCopia.add(event.resultingClientId);
      return marcarComoCopia(copia);
    }
  }

  try {
    return await rede;
  } catch {
    const offline = await caches.match(PAGINA_OFFLINE);
    return offline || Response.error();
  }
}

// A página lê essa marca pra mostrar o aviso de cópia e parar de tentar
// falar com o servidor (src/lib/mercado-offline.ts). O <html> do layout raiz
// tem suppressHydrationWarning, então o atributo a mais não quebra a
// hidratação.
async function marcarComoCopia(copia) {
  // Nunca vazio: a página trata atributo vazio como "não é cópia".
  const salvaEm = copia.headers.get(HEADER_COPIA_EM) || "sem-data";
  const html = (await copia.text()).replace(
    "<html",
    `<html data-copia-offline="${salvaEm}"`,
  );
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function arquivoDoApp(request, cacheAntes) {
  const doCache = () => caches.match(request, { cacheName: CACHE_MERCADO });
  if (cacheAntes) {
    const guardado = await doCache();
    if (guardado) return guardado;
  }
  try {
    return await fetch(request);
  } catch (erro) {
    const guardado = await doCache();
    if (guardado) return guardado;
    throw erro;
  }
}

// ------------------------------------------------------------------
// Cópia do Mercado
// ------------------------------------------------------------------

// Uma operação de cada vez: duas cópias simultâneas misturariam arquivos, e
// uma limpeza (logout) não pode ser atropelada por uma cópia que terminou
// depois dela.
let filaDoMercado = Promise.resolve();

function naFila(tarefa) {
  filaDoMercado = filaDoMercado.then(tarefa).catch(() => {});
  return filaDoMercado;
}

self.addEventListener("message", (event) => {
  // Só páginas do próprio app conseguem mandar mensagem pro service worker.
  const dados = event.data || {};
  if (dados.tipo === "guardar-mercado") {
    const recursos = Array.isArray(dados.recursos) ? dados.recursos : [];
    event.waitUntil(naFila(() => guardarCopia(recursos)));
  } else if (dados.tipo === "limpar-mercado") {
    event.waitUntil(naFila(() => caches.delete(CACHE_MERCADO)));
  }
});

async function guardarCopia(recursosDaPagina) {
  const resposta = await fetch(URL_MERCADO, { cache: "no-store" });
  // Sessão expirada vira redirect pro login: não é a lista, não guarda.
  const tipo = resposta.headers.get("content-type") || "";
  if (!resposta.ok || resposta.redirected || !tipo.includes("text/html")) return;
  const html = await resposta.text();

  const arquivos = new Set();
  for (const caminho of arquivosDoHtml(html)) arquivos.add(caminho);
  for (const caminho of recursosDaPagina) {
    if (typeof caminho === "string" && caminho.startsWith("/_next/static/")) {
      arquivos.add(caminho);
    }
  }

  const cache = await caches.open(CACHE_MERCADO);

  // Arquivo do Next tem hash no nome: se já está guardado, não muda. Os que
  // faltam quase sempre saem do cache HTTP do navegador, sem ir à rede.
  const guardados = new Set(
    (await cache.keys()).map((r) => {
      const u = new URL(r.url);
      return u.pathname + u.search;
    }),
  );
  await Promise.all(
    [...arquivos]
      .filter((caminho) => !guardados.has(caminho))
      .map(async (caminho) => {
        try {
          const r = await fetch(caminho);
          if (r.ok) await cache.put(caminho, r);
        } catch {
          // Um arquivo que falhou não impede a cópia; na próxima ele entra.
        }
      }),
  );

  await cache.put(
    URL_MERCADO,
    new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        [HEADER_COPIA_EM]: new Date().toISOString(),
      },
    }),
  );

  // O que não serve mais pra esta cópia sai — é assim que os arquivos de
  // versões antigas do app vão embora depois de um deploy.
  for (const request of await cache.keys()) {
    const u = new URL(request.url);
    const caminho = u.pathname + u.search;
    if (caminho !== URL_MERCADO && !arquivos.has(caminho)) {
      await cache.delete(request);
    }
  }
}

// Endereços de /_next/static no HTML: nos <script>/<link> e dentro do payload
// do React, onde às vezes aparecem sem o "/_next/" e com colchetes sem
// codificar. As duas grafias entram — o cache compara o endereço exato.
function arquivosDoHtml(html) {
  const achados = new Set();
  for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)<>]+/g)) {
    achados.add(m[0]);
  }
  for (const m of html.matchAll(/(?<![\w/])static\/(?:chunks|media|css)\/[^"'\\\s)<>]+/g)) {
    achados.add("/_next/" + m[0]);
  }
  return achados;
}

// ------------------------------------------------------------------
// Notificações
// ------------------------------------------------------------------

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
