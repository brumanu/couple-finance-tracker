# Relatório UI/UX — Financeiro do Casal

Data: 2026-09-05 · Servidor: http://localhost:3000 (dev) · Sessão já autenticada (cookie), tema inicial escuro.

## (a) O que foi testado ao vivo vs. por código

**Setup.** A janela do Chrome estava maximizada/ancorada e `resize_window` não teve efeito (innerWidth continuou 2560). Para obter viewports reais usei uma "bancada": uma página em `localhost:3000` (mesma origem) com `<iframe>`s de 375×812, 360×780, 768×1024, 1024×768 e 1366×768 apontando para as rotas do app. Dentro do iframe `innerWidth`, media queries do Tailwind, `position: fixed`, `dvh` e `scrollWidth` se comportam como num dispositivo daquele tamanho; as medições foram feitas com `getBoundingClientRect`/`getComputedStyle` via `javascript_tool`. Limitações: (1) o renderer travava com frequência nas capturas (várias `Page.captureScreenshot` deram timeout), então há mais medições numéricas do que screenshots; (2) `env(safe-area-inset-*)` é 0 no desktop — analisado por código; (3) teclado virtual não existe no desktop — analisado por código; (4) o console do iframe não foi capturado pela extensão (0 mensagens) — ver seção (e).

| Item | Ao vivo | Só por código |
|---|---|---|
| `/` (dashboard) | 375, 360, 768, 1024, 1366 · escuro e claro · FAB, bottom-nav, drawer, dialog "Lançar despesa", dialog "Pagar", select | — |
| `/despesas` | 375 (escuro) | tablets/desktop |
| `/recorrentes` | 375, 768, 1024 | — |
| `/rendas` | 375 + drawer abrir/fechar/navegar | — |
| `/cartoes` | 375, 1024 | 768 |
| `/cartoes/[id]` | 375, 768 · dialog "Nova compra" + select de categoria | — |
| `/dividas` | 375 | — |
| `/compras-futuras` | 375 | — |
| `/categorias`, `/bancos` | 375 | — |
| `/relatorios` | 375, 1366 (aba principal) | — |
| `/relatorios/fluxo-mensal` | 375, 1366 | — |
| `/relatorios/gastos-por-categoria` | 375 | — |
| `/relatorios/compras-parceladas` | 375, 768 | — |
| `/login` | — (sessão ativa redireciona para `/`; não posso deslogar/digitar credenciais) | `src/app/login/page.tsx` |
| Toast (sonner) | — (não há como disparar sem gravar dados) | `src/components/ui/sonner.tsx` |
| Teclado virtual, safe-area, reduced-motion | — | CSS/JSX |
| PWA manifest / metas | `GET /manifest.webmanifest` e `<head>` de `/` | `src/app/manifest.ts`, `src/app/layout.tsx` |
| Contraste | cores lidas em runtime + cálculo WCAG das rampas | `globals.css` |

Observação sobre o ambiente dev: cada rota leva 20–50 s para hidratar na primeira carga (compilação sob demanda). Durante esse tempo o usuário vê o **skeleton do dashboard** (`src/app/(app)/loading.tsx`) em qualquer rota — ver problema M6.

## (b) Problemas encontrados (por severidade)

### ALTO

**A1 — Overflow horizontal no dashboard mobile (375 e 360).**
`document.documentElement.scrollWidth` = 428 em 375 px e 414 em 360 px; aparece barra de rolagem horizontal e a página "balança" lateralmente. Causa: a seção "Contas da quinzena" mede 398 px porque o grid `md:grid-cols-[1.1fr_1fr]` sem template no mobile cria uma track `auto`, cuja largura mínima é o *min-content* das linhas (flex `items-center gap-4` com ícone 38 + texto `truncate` (nowrap conta como min-content) + valor `tabular-nums` + botão), 38+143+85+44+3×16+40 = 398.
- Arquivo: `src/app/(app)/page.tsx:548` (`<div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">`) e as linhas em `:1044-1050`.
- Correção: `grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[1.1fr_1fr]` (ou `*:min-w-0` nos `<section>`), e nas linhas trocar o `<span>` de valor por `shrink-0 whitespace-nowrap` explícito + `min-w-0` já existente no texto. O mesmo vale para a seção "Faturas dos cartões" (`page.tsx:1174-1180`), cujo link fica com 19 px de largura em 360 (ver A3).

**A2 — `/recorrentes`: overflow no mobile e nomes ilegíveis em tablet.**
Em 375 o `scrollWidth` é 507 px (seção "Quinzena do dia 15" com 507 px). Em 768 e 1024 (grid de 2 colunas) o nome da conta some ("N…", "D…", "S") e em 768 o "Vence dia 6" quebra palavra por palavra e sobrepõe o valor (screenshot 768×1024). Causa igual à A1: `grid items-start gap-6 md:grid-cols-2` (`src/app/(app)/recorrentes/page.tsx:77`) + linha `flex items-center gap-3.5` com Badge `shrink-0`, valor `whitespace-nowrap font-heading text-[17px]` e dois botões (`:128-165`).
- Correção: `grid-cols-[minmax(0,1fr)] md:grid-cols-2` no grid; na linha, empilhar em telas estreitas: `<div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">` com o bloco valor+ações `ml-auto flex items-center gap-1`, e badge com `max-w-[40%] truncate` ou movê-la para a segunda linha (junto de "Vence dia N"). Em 768 (conteúdo útil ≈ 480 px com sidebar) considerar `lg:grid-cols-2` em vez de `md:`.

**A3 — Rótulo das faturas praticamente invisível em 360/375.**
No dashboard, o link "Fatura Nubank · Bruno" fica com `clientWidth` 19 px (`scrollWidth` 152) em 360 px, e "Fatura C6 B…" em 375 (screenshot). O valor riscado + botão "×"/"Pagar" tomam todo o espaço.
- Arquivo: `src/app/(app)/page.tsx:1195-1203` e `:1213-1233`.
- Correção: `flex-wrap` na linha com valor+ação em `basis-full sm:basis-auto sm:ml-auto`, ou reduzir o rótulo no mobile (`Fatura {banco}` e o apelido na 2ª linha). Também aplicar `min-w-0` no wrapper e `shrink-0` no valor.

**A4 — `/cartoes`: barra de ações do cabeçalho estoura a tela no mobile.**
`scrollWidth` 471 px em 375. O `div.flex.items-center.gap-2` com MonthSwitcher (min-w-36 + 2 botões) + "Bancos" + "Novo cartão" mede 471 px sem `flex-wrap` (o "Novo cartão" aparece cortado no screenshot).
- Arquivo: `src/app/(app)/cartoes/page.tsx:85-94`.
- Correção: `flex flex-wrap items-center gap-2` (o `<header>` pai já tem `flex-wrap`, mas o filho não) ou mover "Bancos" para um `DropdownMenu`/link secundário.

**A5 — Tablet 768 (md): hero do dashboard com valores cortados.**
Em 768 a sidebar expandida (256 px) deixa 497 px para o `main`; o grid `sm:grid-cols-4` dos blocos "Entradas/Contas/Cartões/Despesas" resulta em 83 px por bloco e os valores aparecem truncados ("R$ 16.34", "-R$ 5.43", "-R$ 16.0") — screenshot 768×1024.
- Arquivo: `src/app/(app)/page.tsx:633` (`grid gap-3 sm:grid-cols-4`) e `:691` (`clamp(1rem, 2.4vw, 1.25rem)`).
- Correção: `grid-cols-2 lg:grid-cols-4` (o breakpoint `sm` é avaliado sobre a viewport, não sobre a largura do `main`), ou usar container queries (`@container` no card + `@md:grid-cols-4`). Alternativa: iniciar a sidebar em modo rail (`md:w-[76px]`) por padrão entre 768 e 1023 px.

**A6 — Contraste do laranja primário no tema claro (texto e botões).**
`#c67139` sobre `#f5ead8` = **3,03:1**; `#f5ead8` sobre botão `#c67139` = **3,03:1** (lido em runtime no botão "Confirmar pagamento": `rgb(245,234,216)` sobre `rgb(198,113,57)`). Falha AA (4,5:1) para todo texto normal em `text-primary`: valores negativos "-R$ 5.168,65" nos cards (fonte grande passa em AA-Large, mas as linhas "Contas −R$ 4.293,08" de 13 px não), mensagens de erro `text-primary` (`despesa-form-dialog.tsx:431`, `login/page.tsx:66`), links "ver todas"/"Ver dívidas", rótulo dos botões primários (14 px, heading). No escuro o `#e08a52` fica em 6,7:1 (ok).
- Correção: no `:root` claro usar `--primary: var(--organic-accent-600)` (`#b2622d` → 4,6:1 com cream) para texto/links e manter `#c67139` só em superfícies grandes; ou trocar `--primary-foreground` do botão para `--organic-neutral-900` (`#2e2b25`, ~7:1). Para erros usar `text-destructive` (`#8c491a`, 5,1:1).

### MÉDIO

**M1 — Inputs com 14 px no mobile → zoom automático do iOS Safari ao focar.**
Todos os inputs (`descricao`, `valor`, `data`, `parcelas`, selects) usam `text-sm` (14 px). Safari iOS dá zoom na página quando o `font-size` do campo focado é < 16 px, o que desalinha o dialog (`fixed top-1/2`) e deixa a página "zoomada" ao fechar.
- Arquivo: `src/components/ui/input.tsx:12` (`text-sm`), `src/components/ui/select.tsx:44`.
- Correção: `text-base md:text-sm` (16 px no mobile) em Input e SelectTrigger.

**M2 — Dialog "Nova compra no cartão" não cabe em 375×812 e o rodapé fica escondido.**
Altura medida 690 px (= `max-h-[85dvh]`), `scrollHeight` 719 → o `DialogFooter` (`footBottom` 780 > `bottom` 751) só aparece após rolar dentro do popup. Com teclado virtual aberto (≈ 300 px) sobra ~500 px de visual viewport; como o popup é centralizado por `top-1/2 -translate-y-1/2` e usa `dvh` (no iOS o `dvh` **não** encolhe com o teclado), o campo focado e o botão "Salvar" ficam atrás do teclado. "Lançar despesa" (586 px) e "Pagar" (378 px) cabem sem teclado.
- Arquivo: `src/components/ui/dialog.tsx:56` e `:111`.
- Correção: no mobile renderizar como bottom-sheet: `max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:translate-x-0 max-sm:max-w-none max-sm:rounded-b-none max-sm:max-h-[92dvh]` + `pb-[env(safe-area-inset-bottom)]`; rodapé `sticky bottom-0` no mobile (o comentário em `:105-110` explica por que foi removido — funciona se o conteúdo tiver `pb-20` para compensar). Complementar com `interactive-widget=resizes-content` na meta viewport (Chrome Android) e `scrollIntoView` no `focus` dos inputs.

**M3 — Select de categoria abre "para cima" ocupando a tela inteira e itens de 28 px.**
No dialog de compra (375×812) o popup do select mediu 526 px de altura, de y=5 a y=532 (acima do trigger em y=535), cobrindo Descrição/Valor/Data. Cada `SelectItem` tem 28 px de altura (`py-1`), abaixo dos 44 px recomendados para toque.
- Arquivo: `src/components/ui/select.tsx:91` (`max-h-(--available-height)`) e `:125` (`py-1`).
- Correção: `max-h-[min(var(--available-height),320px)]`, `SelectItem` com `py-2.5 min-h-11` no mobile (`max-sm:min-h-11`), e considerar `side="bottom"` + `collisionPadding`.

**M4 — Alvos de toque abaixo de 44×44 em todas as listas.**
Medidos (375): "Editar" 32×32, "Mais opções" 32×32 / 41×32, "Pagar" 83×32, "Detalhes" 104×32, "Registrar pagamento" 280×32, "Nova conta/Nova dívida/Novo item/Novo banco/Nova categoria/Nova compra/Nova assinatura" 32 px de altura (`size="sm"` = `h-8`), setas do MonthSwitcher 41×32, "Voltar" 89×32, "ver todas" 54×20, botão fechar do dialog 32×32, "Fechar menu" do drawer 34×34, ícones do rodapé do drawer (tema/push/sair) 32×32. Só o menu/busca do header (44) e o FAB (60) estão ok.
- Arquivos: `src/components/ui/button.tsx:26-31` (`sm: h-8`, `icon-sm: size-8`), `src/components/ui/dialog.tsx:69`, `src/components/nav/sidebar.tsx:917,1026`, `src/components/nav/theme-toggle.tsx:1137`, `*-actions-menu.tsx` (`size="sm"`), `EditXTrigger` (`size="icon-sm"`).
- Correção: nas variantes `sm`/`icon-sm` acrescentar `max-md:h-11 max-md:min-w-11` (ou criar `size="touch"`); nos ícones de lista usar `size-11 -m-1.5` para aumentar a área sem mudar o visual; `p-2` → `p-3` nos botões do drawer.

**M5 — Drawer mobile sem semântica de dialog nem gestão de foco.**
Ao abrir: `document.activeElement` continua em `<body>`, `<aside>` não tem `role="dialog"`/`aria-modal`, o conteúdo de fundo não fica `inert`, e o foco não volta ao botão "Abrir menu" ao fechar. Esc e backdrop funcionam; body recebe `overflow:hidden` e volta ao normal; fecha ao navegar (testado: "Contas" → `/recorrentes`, `asideX` -272, `overflow` "").
- Arquivo: `src/components/nav/sidebar.tsx:871-881`, `src/components/nav/sidebar-provider.tsx:778-790`.
- Correção: renderizar o drawer com `DialogPrimitive` do base-ui (já usado em `dialog.tsx`) ou adicionar `role="dialog" aria-modal="true" aria-label="Menu"`, focar o botão "Fechar menu" ao abrir e devolver o foco ao gatilho ao fechar; `inert` no `<main>` enquanto aberto. Também `overflow:hidden` no body não trava o scroll no iOS — usar `position:fixed` no body ou `overscroll-behavior: contain` no aside.

**M6 — Skeleton do dashboard aparece em todas as rotas e estoura a tela.**
Confirmado no DOM: durante o carregamento de `/relatorios`, `/rendas`, `/cartoes` etc. o `main` visível continha o skeleton de `src/app/(app)/loading.tsx` (hero + gráfico de 6 barras + 2 cards, 2384 px de altura), e só depois o conteúdo real. Como `(app)/loading.tsx` é o boundary do layout, ele envolve **todos** os segmentos filhos — o usuário vê um layout de dashboard e depois um salto para a lista da rota (layout shift grande). Além disso `Skeleton className="w-96"` (384 px) em `loading.tsx:17` e em todos os `relatorios/*/loading.tsx:11-12` estoura os 343 px úteis de 375 px (`scrollWidth` 428 durante o loading).
- Correção: trocar `w-96` por `w-full max-w-96`; mover o skeleton do dashboard para um `Suspense` dentro de `page.tsx` (ou reduzir `(app)/loading.tsx` a um skeleton genérico de cabeçalho) para que cada rota mostre o seu próprio `loading.tsx`.

**M7 — FAB cobre CTAs e valores no final das listas.**
O FAB (60 px, `bottom: 88px + safe-area`) é `fixed`, então em qualquer posição de rolagem ele cobre o que estiver em y ≈ 648–708 (375×812): no `/despesas` vazio ele cobre o botão "Lançar despesa" do estado vazio (screenshot), em `/rendas` o botão "Renda extra", em `/dividas` "Registrar pagamento", no dashboard os blocos "Despesas R$ 0,00". O `pb-44` do `main` (176 px) só garante o **fim** da página.
- Arquivo: `src/components/nav/mobile-fab.tsx:18`, `src/app/(app)/layout.tsx:40`.
- Correção: posicionar o FAB à direita (`justify-end pr-4`) para não cobrir botões centralizados/largos, ou esconder o FAB nas telas que já têm CTA próprio (`usePathname()`), ou integrá-lo ao bottom-nav como item central elevado. Como o dialog do FAB é "Lançar despesa", em `/despesas` o CTA do estado vazio é redundante com ele.

**M8 — Fontes abaixo de 12 px em rótulos informativos.**
Encontrados: 9 px (ano "26" no gráfico, `page.tsx:821`), 10 px (blocos "Entradas/Contas…" `:684`, valores das barras `:762`, meses `:813`, "Crédito/Parcela/Valor da parcela/Falta pagar" em `/cartoes/[id]:288-339`, "Categoria/Ordenar por" nos filtros dos relatórios, valores/meses do gráfico de fluxo `fluxo-mensal/page.tsx:386,395`, "Out/25"), 11 px (labels dos bottom-nav `bottom-nav.tsx:525`, cabeçalhos de card "Sobra em…", badges `badge.tsx:8`, "⌘K"). O `text-neutral-500` de 9 px no claro tem contraste 2,15:1.
- Correção: mínimo 11 px para rótulos e 12 px para valores; no gráfico usar `text-[11px]` e `text-neutral-700`; nos blocos do hero `text-[11px]`. No mobile o gráfico de projeção já rola horizontalmente (`scrollWidth` 358 > 281) e os valores "R$ 5.269,80" (56 px) são mais largos que a coluna de 52 px — considerar `min-w-[64px]` e valor abreviado ("5,3k").

**M9 — Cores hardcoded fora do sistema (`text-red-600`).**
Itens "Excluir" dos menus e mensagens de erro usam `text-red-600` (`#dc2626`): 3,2:1 sobre o card escuro e 3,6:1 no claro, e visualmente destoa da paleta Organic.
- Arquivos: `despesa-actions-menu.tsx:34`, `categoria-actions-menu.tsx:38`, `compra-futura-actions-menu.tsx:53`, `recorrente-actions-menu.tsx:57`, `renda-actions-menu.tsx:57`, `renda-extra-actions-menu.tsx:34`, `pagar-dialog.tsx:121`, `pagar-fatura-dialog.tsx:109`, `recorrente-form-dialog.tsx:230`, `renda-form-dialog.tsx:156`.
- Correção: `variant="destructive"` no `DropdownMenuItem` (já existe em `dropdown-menu.tsx:91`) e `text-destructive` nos erros.

**M10 — Sem `prefers-reduced-motion`.**
Nenhuma ocorrência de `motion-reduce`/`prefers-reduced-motion` no projeto; `tw-animate-css` anima dialogs/menus (`zoom-in-95`, `slide-in-from-*`), o drawer usa `transition-transform`, skeletons `animate-pulse`.
- Correção em `globals.css`: `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }` ou `motion-safe:` nos utilitários de animação.

**M11 — PWA: falta `viewport-fit=cover` e o `theme-color` não acompanha o tema escolhido.**
`<meta name="viewport" content="width=device-width, initial-scale=1">` — sem `viewport-fit=cover`, `env(safe-area-inset-bottom)` é sempre 0 no iOS em modo standalone, então o `h-[env(safe-area-inset-bottom)]` do bottom-nav (`bottom-nav.tsx:548`) e o offset do FAB não têm efeito e a barra de gestos do iPhone cobre os rótulos. Os `theme-color` usam `media: prefers-color-scheme`, mas o tema do app é decidido por `localStorage` (`theme-init.tsx`) — usuário com sistema claro e app escuro terá barra de status laranja `#c67139` sobre app escuro (e vice-versa). `apple-mobile-web-app-status-bar-style: default` idem. O manifest é válido (200, `display: standalone`, `start_url: /`, ícones 512 `any` e 180 apple, `theme_color`, `background_color`, `lang`), mas falta ícone `purpose: "maskable"` (Android recorta o ícone) e um tamanho 192×192.
- Correção: `viewport: { ..., viewportFit: "cover" }` em `layout.tsx:463`; atualizar `<meta name="theme-color">` via JS no `aplicarTema()`/`ThemeInitScript`; no manifest adicionar `{ src: "/icon", sizes: "192x192", purpose: "maskable" }` (gerado com padding no `icon.tsx`).

### BAIXO

**B1 — Select "Quinzena" mostra "15" em vez de "Dia 15".** `<SelectValue />` sem children renderiza o `value` bruto (`despesa-form-dialog.tsx:366`). Correção: `<SelectValue>{quinzena === "15" ? "Dia 15" : "Dia 30"}</SelectValue>` ou usar `items` do base-ui.

**B2 — Selects lado a lado truncam ("Sem categor…", "Não especifi…") no grid 2 colunas do dialog de despesa** (375). `despesa-form-dialog.tsx:348` — usar `grid-cols-1 sm:grid-cols-2` para Categoria/Quem gastou, ou `SelectTrigger` com `truncate` e rótulo mais curto ("Ninguém").

**B3 — Rail/desktop: e-mail do usuário truncado a 48 px** (`sidebar.tsx:1017`, `w-64` com 3 ícones ao lado). Mostrar só o nome, e o e-mail em `title`, ou mover push/tema/sair para um menu do avatar.

**B4 — Drawer mobile inclui "⌘K" no botão Buscar** (`sidebar.tsx:941-948`), sem sentido em touch: `hidden md:inline-flex`.

**B5 — Botão "Início" do bottom-nav coberto pelo indicador "N" do Next DevTools** no dev (canto inferior esquerdo). Não é bug de produção, mas atrapalha teste; pode ser desligado com `devIndicators: false` em `next.config.ts` ou reposicionado.

**B6 — Tabelas nos relatórios em 768**: `hidden md:block` mostra a `<table>` a partir de 768, mas com sidebar expandida ela tem 433 px de largura e 923 px de conteúdo (compras-parceladas), exigindo rolagem horizontal dentro do card; a lista mobile (`md:hidden`) seria melhor até `lg`. Também o gráfico (`-mx-1 overflow-x-auto`) rola em 375 (932/296) sem indicação visual de que rola — adicionar sombra/gradiente ou `scroll-snap`.

**B7 — Foco visível**: botões têm `focus-visible:ring-2` (ok); links das listas (`Link` "Fatura…", "ver todas", cards de relatório) só têm `hover:underline` — adicionar `focus-visible:underline`/`ring`. Ordem de foco nos dialogs: ao abrir, base-ui foca o primeiro campo (`INPUT#descricao` no "Lançar despesa"); com abertura programática o foco ficou no body — verificar `initialFocus`.

**B8 — `error.tsx`/`not-found.tsx` usam `rounded-md` e "Pagina nao encontrada" sem acentos** (`src/app/(app)/not-found.tsx:6`), destoando do design (botões `rounded-full`, fonte heading).

**B9 — Login (por código)**: `main.flex.flex-1.items-center.justify-center.p-6` + card `max-w-[430px] px-8 py-9` cabe em 360 (296 px úteis); `type="email"`/`autoComplete` corretos; inputs 14 px (M1 também vale aqui); erro em `text-primary` (A6). Falta `<h1>` único? Existe. Sugestão: `inputMode="email"` e `enterKeyHint="go"`.

## (c) Checagem tela × viewport

Legenda: OK · ⚠ problema (código) · — não testado ao vivo (análise de código) · (E) escuro (C) claro.

| Tela | 375×812 | 360×780 | 768×1024 | 1024×768 | 1366×768 |
|---|---|---|---|---|---|
| `/` dashboard | ⚠ A1, A3, M7, M8 (E/C) | ⚠ A1, A3 (E) | ⚠ A5 (E) | OK (sw 1009) · M4 | OK (E/C) · M4, B3 |
| `/despesas` | ⚠ M7 (FAB sobre CTA) (E) | — | — | — | — |
| `/recorrentes` | ⚠ A2 (sw 507) | — | ⚠ A2 (nomes somem) | ⚠ A2 (nomes "N…") | — |
| `/rendas` | OK · M7 | — | — | — | — |
| `/cartoes` | ⚠ A4 (sw 471) | — | — (mesma toolbar cabe ≥ 640) | OK · M4 | — |
| `/cartoes/[id]` | OK · M2, M3, M4, M8 | — | OK (sw 753) | — | — |
| `/dividas` | OK · M4, M7 | — | — | — | — |
| `/compras-futuras` | OK · M4 | — | — | — | — |
| `/categorias` | OK · M4 | — | — | — | — |
| `/bancos` | OK · M4 | — | — | — | — |
| `/relatorios` | OK | — | — | — | OK |
| `/relatorios/fluxo-mensal` | OK · M8, B6 | — | — | — | OK |
| `/relatorios/gastos-por-categoria` | OK · M8 | — | — | — | — |
| `/relatorios/compras-parceladas` | OK · M8, B6 | — | ⚠ B6 (tabela 923/433) | — | — |
| `/login` | — B9 | — | — | — | — |
| Drawer mobile | abre/fecha/navega OK · M5 | — | n/a (sidebar) | n/a | n/a |
| Dialog "Lançar despesa" | cabe (586 px) · M1, B1, B2 | — | — | — | — |
| Dialog "Nova compra" | ⚠ M2, M3 | — | — | — | — |
| Dialog "Pagar" | cabe (378 px) · M1 (C) | — | — | — | — |

Breakpoints: `md` (768) é onde sidebar/bottom-nav/FAB trocam (`md:hidden`/`md:sticky`); em **exatamente 768** já é o layout desktop com sidebar expandida de 256 px, deixando ~497 px de conteúdo — pior caso da app (A2, A5, B6). Em 1024 o conteúdo tem ~753 px e os grids de 2 colunas ainda espremem (A2). Sem `lg` em nenhum grid.

## (d) Sugestões de melhoria de UX (não bugs)

**Mobile**
1. Acima da dobra (375×812) aparecem: header, "Oi, Bruno", frase do dia, MonthSwitcher, cabeçalho do hero e o valor "-R$ 5.168,65"; os 4 blocos (Entradas/Contas…) já ficam empilhados um por linha (`sm:grid-cols-4` só ≥ 640) e o "Sobra da quinzena atual" (o número mais acionável) só aparece após ~1,5 tela de rolagem. Sugestão: no mobile, colocar a **sobra da quinzena atual** no hero (ou um chip "Quinzena atual: R$ 2.347,08" logo abaixo do valor do mês) e usar `grid-cols-2` para os 4 blocos (cabem 2 por linha em 343 px).
2. Bottom-nav com 6 itens de 53 px e rótulos de 11 px é denso; considerar 5 itens (Início, Rendas, Contas, Cartões, Despesas) com "Dívidas" no drawer, ou rótulo só no ativo.
3. Bottom-sheet para dialogs (ver M2) e "Salvar" sempre visível; `autoFocus` no campo Valor com `inputmode="decimal"` (já existe) e teclado numérico — considerar máscara de moeda.
4. Linhas de lista: padronizar um `ListRow` com 2 linhas (título / meta) e valor à direita em `shrink-0`, ações em um único menu "…" (edição via item de menu) — reduz 2 botões por linha e resolve A1–A3.
5. Gráfico de projeção: em 375 rola horizontalmente sem affordance; mostrar 4 meses + "ver mais" ou trocar por sparkline.
6. Feedback de navegação: o `LinkPendingDot` só aparece no item clicado; com 20–50 s de carregamento em dev (menos em prod) uma barra de progresso no topo ajudaria.
7. Toasts em `top-center` não colidem com bottom-nav/FAB (ok), mas ficam sob o header sticky (`z-30` vs sonner `z-[9999]`, então sobrepõem — ok). Considerar `offset` para respeitar `safe-area-inset-top` em standalone.

**Tablet**
1. Iniciar em rail (`collapsed=true`) entre 768 e 1023 px, ou só trocar para sidebar em `lg` (1024) e manter bottom-nav até lá — o layout de 768 hoje é o pior de todos.
2. Grids `md:grid-cols-2` → `lg:grid-cols-2`; tabelas `hidden md:block` → `hidden lg:block`.
3. Em paisagem (1024×768) a altura útil é curta: o hero + gráfico ocupam a tela inteira; considerar hero mais compacto (`md:p-6`) e gráfico à direita do hero em `lg:grid-cols-[1fr_1fr]`.

**Desktop**
1. Rodapé da sidebar com 4 controles em 220 px: trocar por menu do avatar.
2. Atalho ⌘K ok; adicionar `/` ou `Ctrl+K` no Windows (o rótulo "⌘K" confunde usuários Windows).

## (e) Console / hidratação / PWA

- `read_console_messages` (padrão `error|warn|hydrat|Error|Warning`) não retornou mensagens; a extensão só captura o console da aba principal e as páginas rodaram em iframes, portanto **não é possível afirmar ausência de erros**. Na navegação direta da aba para `/` e `/relatorios` também não houve mensagens capturadas (o tracking começa após a primeira chamada).
- Não observei sintomas de hydration mismatch: `suppressHydrationWarning` no `<html>` cobre a classe `dark` injetada pelo `ThemeInitScript`; `ThemeToggle`/`SidebarProvider` usam `useSyncExternalStore` com snapshot de servidor neutro (bom).
- `sonner.tsx` importa `useTheme` de `next-themes`, mas o app não usa `ThemeProvider` do next-themes (tema é classe manual) — `theme` cai em `"system"`, então o toast segue `prefers-color-scheme`, não o tema escolhido no app (toast claro sobre app escuro, ou vice-versa). Correção: passar `theme={document.documentElement.classList.contains("dark") ? "dark" : "light"}` via o mesmo store do `ThemeToggle`.
- DOM: durante o carregamento existe um `div[hidden]` com o conteúdo streamado e o skeleton do dashboard visível (M6) — comportamento do App Router, não erro.
- PWA: `GET /manifest.webmanifest` → 200, JSON válido (`name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `orientation: "portrait"`, `theme_color: "#c67139"`, `background_color: "#f5ead8"`, `lang: "pt-BR"`, ícones 512 `any` + 180 apple). `<head>`: `viewport` sem `viewport-fit=cover`, `theme-color` ×2 por `prefers-color-scheme`, `apple-mobile-web-app-title`, `apple-touch-icon`, `link rel=manifest`. Faltam `maskable` e 192 px (M11). `orientation: portrait` bloqueia paisagem em tablets instalados — considerar `"any"`.
