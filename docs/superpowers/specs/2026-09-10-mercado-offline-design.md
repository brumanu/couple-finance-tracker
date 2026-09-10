# Mercado sem internet — desenho

Data: 10/09/2026 · Aprovado pelo usuário em chat antes da implementação.

## Problema

A lista do Mercado já guarda as marcações feitas sem sinal (fila no
`localStorage`, `src/lib/mercado-fila.ts`), mas só se a página já estava
aberta. Abrir o app sem sinal — o caso comum dentro do mercado — dava a
página "Sem conexão", e a fila offline nunca chegava a ser usada.

## Escopo

- Só `/mercado`. Nenhuma outra página nem dado vai pro cache: número
  financeiro velho exibido como atual é pior que dizer que falta internet.
- Fora de escopo: finalizar a compra offline (lança despesa, precisa do
  servidor), histórico e detalhe de compras anteriores.

## Como funciona

### Guardar a cópia (online)

1. `CopiaOffline` (em `/mercado`) pede ao service worker uma cópia quando a
   tela abre e quando a lista muda (nova, finalizada). A `ListaCliente` pede
   outra depois de cada envio da fila. Pedidos em sequência viram um a cada
   15s, sempre o último (`src/lib/mercado-offline.ts`). Na primeira abertura
   depois de um deploy o pedido vai pro service worker antigo, que não sabe
   guardar cópia; por isso ele é refeito no `controllerchange`, quando o novo
   assume.
2. O service worker busca `/mercado` de novo (`fetch` com cookie, sem cache
   HTTP). Redirect (sessão expirada), erro ou resposta que não é HTML: não
   guarda.
3. Junta os arquivos de `/_next/static` que a cópia precisa: os que o HTML
   referencia (tags e payload do React, nas duas grafias que aparecem) e os
   que a página relatou ter carregado — um `PerformanceObserver` iniciado com
   o app anota tudo, inclusive fontes (vêm do CSS) e chunks carregados depois.
4. Guarda no cache `mercado-offline` o HTML (com o header `x-copia-em`) e os
   arquivos que faltam; apaga o que não pertence mais à cópia. É isso que
   limpa os arquivos de versões antigas depois de um deploy.

Operações no cache passam por uma fila única no service worker: duas cópias
não se misturam e uma limpeza não é atropelada por uma cópia atrasada.

### Abrir sem sinal

- Navegação para `/mercado` com cópia guardada: rede primeiro, com limite de
  5s. Sem resposta, falha de rede ou 5xx → serve a cópia. Sem cópia → página
  "Sem conexão" como antes.
- Ao servir a cópia, o service worker marca `<html data-copia-offline="…">`
  com a hora em que ela foi salva. O layout raiz tem `suppressHydrationWarning`
  no `<html>`, então a marca sobrevive à hidratação.
- Abas que abriram a cópia pegam `/_next/static` do cache primeiro; as outras,
  da rede primeiro (em desenvolvimento o mesmo endereço muda de conteúdo).
- O app abre no Início, que não tem cópia. A página "Sem conexão" mostra
  "Abrir a lista do mercado" quando existe cópia.

### Na cópia

- Aviso no topo: "Sem conexão. Esta é a lista salva às HH:MM…", com
  "Tentar conectar".
- Marcações vão pra fila local, que **não é enviada** da cópia. Finalizar
  mostra que precisa de internet. `router.refresh()` é suspenso.
- A cada 10s (e no evento `online`) testa o servidor com `HEAD /offline.html`
  — `navigator.onLine` mente no mercado. Respondeu: recarrega a página.

### Voltar a ter sinal

A página recarrega **antes** de enviar a fila. A cópia pode ser de uma versão
anterior do app, cujas server actions o servidor já não reconhece depois de
um deploy. A página nova adota a fila do `localStorage` (mecanismo que já
existia) e envia com a versão atual.

### Sair da conta

A cópia tem a lista e o nome do casal. É apagada no logout (submit do
formulário do menu) e ao abrir a tela de login (sessão que expirou sozinha) —
direto pela Cache API e também por mensagem ao service worker, pra entrar na
fila atrás de uma cópia em andamento.

## Correção junto

`flush` da `ListaCliente` não tratava a rejeição da server action sem rede:
o indicador ficava preso em "salvando…". Agora cai em "pendente".

## Arquivos

- `public/sw.js` — cópia, navegação com limite, arquivos do app, mensagens.
- `src/lib/mercado-offline.ts` — pedidos ao service worker, coleta de
  arquivos, leitura da marca de cópia.
- `src/app/(app)/mercado/copia-offline.tsx` — pedido de cópia e aviso.
- `src/app/(app)/mercado/lista-cliente.tsx` — sem envio na cópia; pede cópia
  após envio; catch no flush.
- `public/offline.html` — atalho pra cópia.
- `src/components/nav/sidebar.tsx`, `src/components/pwa/limpar-copia-offline.tsx`,
  `src/app/login/page.tsx` — limpeza.
