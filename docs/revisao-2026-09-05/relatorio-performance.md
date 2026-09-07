# Relatório de Performance e Arquitetura — Financeiro do Casal

Escopo: Next.js 16.3 (App Router, Turbopack) + React 19 + Supabase (@supabase/ssr) + Base UI. Todos os caminhos são relativos a `C:\Users\bruno\Documents\Financeiro\couple-finance-tracker`. Nenhum arquivo do projeto foi modificado (apenas `.next/` gerado pelo build).

Resumo do estado atual: o projeto já aplica boas práticas em vários pontos — `Promise.all` nas pages, `React.cache()` em `requireSession`/`getCategorias`/`getMembrosCasal`/`getCartoesParaSelecao`, `getClaims()` no lugar de `getUser()` no middleware e na sessão, nenhum `select("*")`, `loading.tsx` em toda rota, ícones lucide importados por nome, `Intl.NumberFormat` hoisted. Os problemas restantes são de outra ordem: bundle inicial pesado para PWA mobile, layout que bloqueia a shell, duplicação massiva de código (dialogs/actions/relatórios), server actions com 4–5 round-trips sequenciais, e ausência de tipos gerados do Supabase.

---

## (a) Resultado do build

`npm run build` — **sucesso (exit 0), sem warnings**. Compilação Turbopack 11,6 s; TypeScript 5,2 s; 26 páginas geradas em 382 ms. Todas as rotas `(app)` são dinâmicas (ƒ) porque usam `cookies()`; só `/icon`, `/apple-icon`, `/manifest.webmanifest` e `/_not-found` são estáticas. Proxy (middleware) ativo.

O Next 16 não imprime mais "First Load JS" na saída. Os números abaixo foram calculados somando os chunks referenciados em `.next/server/app/**/page_client-reference-manifest.js` + `rootMainFiles` de `build-manifest.json` (script em `scratchpad/bundle.js`). "gz" = gzip real dos arquivos.

**Chunks compartilhados por todas as rotas** (6 chunks): 428,4 KB raw / **127,5 KB gz**
| Chunk | raw | gz | Conteúdo |
|---|---|---|---|
| 08ttfj81-47mu.js | 223,7 KB | 69,9 KB | react-dom + App Router runtime |
| 2fza_xeidyl42.js | 130,0 KB | 34,5 KB | Next runtime (AppRouter) |
| 2tswzwt7g9k6a.js | 32,1 KB | 8,5 KB | Next |
| 43qi2ef0_-07u.js | 26,8 KB | 8,4 KB | Next + server references |
| turbopack-…js | 10,7 KB | 4,2 KB | runtime |
| 310vm2bl3xxpt.js | 5,2 KB | 1,9 KB | — |

**Chunks que aparecem em TODAS as rotas `(app)`** (vêm do `(app)/layout.tsx`, mas o manifest os lista por página): `1payr_otevqgi.js` 97 KB (Base UI + floating-ui: Select/Dialog/Menu), `2hpczfttdrv1i.js` 53 KB (sonner + Base UI), `1cogx0vrhsjlt.js` 39 KB (código do app: `DespesaFormDialog`, sidebar, search), `254hv-pya2m62.js` 34 KB (Base UI). Ou seja, o custo real de "entrar no app" é ~740 KB raw / **~229 KB gz** de JS.

**First Load JS por rota** (ordenado por tamanho):
| Rota | só da página raw | só da página gz | First Load raw | **First Load gz** |
|---|---|---|---|---|
| /relatorios/compras-do-mes | 408,1 KB | 128,8 KB | 836,5 KB | **256,3 KB** |
| /cartoes/[id] | 386,5 KB | 124,5 KB | 815,0 KB | **252,0 KB** |
| /rendas | 380,4 KB | 122,8 KB | 808,8 KB | 250,3 KB |
| /compras-futuras | 377,6 KB | 122,3 KB | 806,0 KB | 249,8 KB |
| /cartoes | 376,6 KB | 122,1 KB | 805,0 KB | 249,5 KB |
| /dividas/[id] | 375,6 KB | 121,4 KB | 804,0 KB | 248,9 KB |
| /recorrentes | 374,6 KB | 121,6 KB | 803,0 KB | 249,1 KB |
| /bancos | 372,9 KB | 121,1 KB | 801,3 KB | 248,6 KB |
| /categorias | 372,9 KB | 121,2 KB | 801,3 KB | 248,6 KB |
| /dividas | 372,0 KB | 120,8 KB | 800,5 KB | 248,3 KB |
| /despesas | 370,6 KB | 120,4 KB | 799,1 KB | 247,9 KB |
| /relatorios/compras-parceladas | 327,7 KB | 106,0 KB | 756,1 KB | 233,5 KB |
| /relatorios/assinaturas | 323,7 KB | 104,9 KB | 752,1 KB | 232,4 KB |
| /relatorios/gastos-por-categoria | 323,4 KB | 105,2 KB | 751,8 KB | 232,7 KB |
| /relatorios/maiores-gastos | 320,8 KB | 104,7 KB | 749,2 KB | 232,2 KB |
| / (dashboard) | 319,5 KB | 104,1 KB | 747,9 KB | 231,5 KB |
| /relatorios/gastos-por-pessoa | 313,2 KB | 102,4 KB | 741,7 KB | 229,9 KB |
| /relatorios/renda-x-despesa | 313,2 KB | 102,4 KB | 741,7 KB | 229,9 KB |
| /relatorios/categoria-por-mes, comprometimento-futuro, fluxo-mensal, /relatorios | 311,7 KB | 101,7 KB | 740,1 KB | 229,1 KB |
| /login | 75,8 KB | 25,0 KB | 504,2 KB | 152,5 KB |
| /_not-found | 14,0 KB | 3,6 KB | 442,4 KB | 131,1 KB |

Leitura: ~105 KB gz são React + Next (incompressível), ~65–75 KB gz são Base UI + floating-ui + sonner, o resto é código do app. A diferença entre a rota mais leve (229 KB) e a mais pesada (256 KB) é pequena — o problema é o piso, não o teto. Para um PWA usado no celular, 230 KB gz antes de interagir é alto; a meta razoável é ~150 KB gz na rota inicial.

---

## (b) Achados por impacto

### ALTO

#### A1. Layout carrega `DespesaFormDialog` (FAB) + `GlobalSearchDialog` em toda rota, puxando Base UI Select/Dialog + floating-ui (~150 KB raw) para o bundle inicial
- `src/app/(app)/layout.tsx:44-50` renderiza `<MobileFab cartoes categorias membros />` e `<GlobalSearchDialog />` sempre.
- `src/components/nav/mobile-fab.tsx:5` importa `DespesaFormDialog` estaticamente → traz `Select`, `Dialog`, `CategoriaSelectField`, `QuemGastouSelectField`, `BancoIcone`, `sonner`, `playCoinSound`.
- Consequência: os chunks `1payr_otevqgi` (97 KB), `2hpczfttdrv1i` (53 KB), `254hv` (34 KB) entram em todas as 22 rotas.

Ganho esperado: −60 a −80 KB gz no first load de todas as rotas (~30%); dialogs só baixam ao primeiro clique.

Correção:
```tsx
// mobile-fab.tsx
"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
const DespesaFormDialog = dynamic(
  () => import("@/app/(app)/despesas/despesa-form-dialog").then(m => m.DespesaFormDialog),
  { ssr: false, loading: () => null },
);
export function MobileFab(props: Props) {
  const [armado, setArmado] = useState(false); // só monta o dialog após 1º toque
  return armado
    ? <DespesaFormDialog {...props} trigger={<FabButton />} />
    : <FabButton onClick={() => setArmado(true)} />;
}
```
Mesmo padrão para `GlobalSearchDialog` (montar via `dynamic` só quando `open` for true pela primeira vez). Complemento: trocar `sonner` por um toast mínimo não é necessário; `next/dynamic` já tira ~10 KB gz da rota inicial se o toaster também for lazy.

#### A2. Uma instância completa de form-dialog por linha da lista (props `categorias`/`membros` serializadas N vezes no RSC payload)
- `src/app/(app)/despesas/page.tsx:208-212` → `<EditDespesaTrigger despesa={d} categorias={categorias} membros={membros} />` por despesa.
- Mesmo padrão em `rendas/page.tsx:252,315`, `recorrentes/page.tsx:160`, `cartoes/[id]/page.tsx:348,430`, `compras-futuras/page.tsx:362`, `bancos/page.tsx:82`, `categorias/page.tsx:97`, `dividas/page.tsx:182`, `relatorios/compras-do-mes/relatorio-client.tsx:640-685`.
- Cada `DespesaFormDialog` (`despesa-form-dialog.tsx:79-138`) instancia 9 `useState` + `useActionState` + 2 `useMemo` + `useResetAoAbrir` mesmo fechado (Base UI desmonta só o `Popup`; o componente e seus hooks ficam vivos). Com 80 despesas no mês são ~1.000 hooks ociosos e o array `categorias` (+`membros`) repetido 80× no payload RSC e na hidratação.

Ganho esperado: RSC payload de listas −50–70%; hidratação mais leve; menos memória em listas grandes. É também o pré-requisito para a abstração do item (c)-2.

Correção: um único dialog por página controlado por estado "editando", com um Provider leve:
```tsx
// despesas/despesa-edit-provider.tsx ("use client")
const Ctx = createContext<(d: DespesaRow) => void>(() => {});
export function DespesaEditProvider({ children, categorias, membros }) {
  const [editando, setEditando] = useState<DespesaRow | null>(null);
  return (
    <Ctx.Provider value={setEditando}>
      {children}
      {editando && (
        <DespesaFormDialog despesa={editando} categorias={categorias} membros={membros}
          open onOpenChange={(o) => !o && setEditando(null)} />
      )}
    </Ctx.Provider>
  );
}
export function EditDespesaButton({ despesa }) {
  const abrir = useContext(Ctx);
  return <Button size="icon-sm" variant="ghost" onClick={() => abrir(despesa)}><PencilIcon/></Button>;
}
```
Na page: `<DespesaEditProvider categorias membros>` envolve a lista; cada linha só renderiza `<EditDespesaButton despesa={d} />` (props pequenas).

#### A3. Server actions com 4–5 round-trips sequenciais ao Supabase, incluindo `getUser()` (rede) onde `getClaims()` (local) já basta
- `src/app/(app)/despesas/actions.ts:101-127`: `getUser()` → `profiles.select("casal_id")` → `resolverCategoria` → `resolverQuemGastou` → `insert`. Cinco esperas em série.
- Padrão idêntico em 17 lugares (`grep 'select("casal_id")'`): `recorrentes/actions.ts:65-90`, `pagar/actions.ts:27-38, 87-98`, `cartoes/[id]/actions.ts`, `assinatura-actions.ts`, `rendas/*`, `dividas/*`, `compras-futuras/actions.ts`, `bancos/actions.ts`, `categorias/actions.ts`, `lib/push/actions.ts:20-30`.
- `supabase.auth.getUser()` faz round-trip ao Auth server a cada action; `requireSession()` (`src/lib/auth.ts:221`) já resolve `userId`/`casalId` via `getClaims()` + 1 query e é memoizado por request.

Ganho esperado: de 5 para 2 round-trips por mutação (ou 1, com defaults no banco). Em Vercel gru1 ↔ Supabase, cada round-trip custa dezenas de ms; o "Salvando…" do dialog fica visivelmente mais curto.

Correção (duas camadas):
```ts
// 1) Postgres: casal_id e criado_por deixam de ser responsabilidade da action
alter table public.lancamentos     alter column casal_id   set default public.current_casal_id(),
                                   alter column criado_por set default auth.uid();
-- repetir para contas_recorrentes, compras_cartao, assinaturas_cartao, dividas,
-- pagamentos_divida, pagamentos_fatura, compras_futuras, rendas, bancos, cartoes, categorias
```
```ts
// 2) helper único src/lib/actions/with-session.ts
export async function withSession<T>(fn: (ctx: { supabase; userId; casalId }) => Promise<T>) {
  const [supabase, session] = await Promise.all([createClient(), requireSession()]);
  return fn({ supabase, userId: session.userId, casalId: session.casalId });
}
// e nas actions: const [cat, quem] = await Promise.all([resolverCategoria(...), resolverQuemGastou(...)]);
```
Observação: `resolverCategoria`/`resolverQuemGastou` só validam existência; a FK `categoria_id → categorias(id)` já garante existência e a RLS de leitura garante que o id pertence ao casal apenas no `select`. Se quiser eliminar as 2 queries, adicione um `check`/trigger `categoria_pertence_ao_casal()` no banco e passe a confiar no erro de FK.

#### A4. `(app)/layout.tsx` bloqueia a shell inteira (sidebar, nav, skeleton) até sessão + cartões + categorias + membros resolverem
- `src/app/(app)/layout.tsx:18-23`: `await Promise.all([requireSession(), getCartoesParaSelecao(), getCategorias(), getMembrosCasal()])` antes de qualquer JSX. `getCartoesParaSelecao` são 2 queries em série (`cartoes-selection.ts:779-792`).
- Como `loading.tsx` só entra depois do layout, o usuário vê tela branca durante sessão + 4 queries, e só então o skeleton da page.
- Os 3 fetches extras existem apenas para alimentar o `MobileFab` (dialog fechado).

Ganho esperado: shell + skeleton pintados após 1 query (profile) em vez de 5; TTFB percebido cai ~50–100 ms em toda navegação hard.

Correção:
```tsx
// layout.tsx
const session = await requireSession();
return (
  <SearchProvider><SidebarProvider>
    …
    <Suspense fallback={null}>
      <MobileFabLoader />   {/* async server component: faz os 3 fetches e renderiza <MobileFab/> */}
    </Suspense>
  …
```
Combinado com A1 (dialog lazy), o `MobileFabLoader` pode até não buscar nada: o dialog busca `cartoes/categorias/membros` via server action ao abrir pela primeira vez.

#### A5. Relatórios: a mesma "agregação de 4 fontes" (despesas + contas fixas + parcelas de cartão + assinaturas) está copiada 8 vezes, sempre carregando `compras_cartao` inteira e iterando O(meses × compras × parcelas)
- Cópias: `relatorios/gastos-por-categoria/page.tsx:128-229`, `maiores-gastos/page.tsx:135-232`, `compras-do-mes/page.tsx:139-259`, `gastos-por-pessoa/page.tsx:176-237`, `renda-x-despesa/page.tsx:102-182`, `fluxo-mensal/page.tsx:123-198`, `categoria-por-mes/page.tsx:81-163`, `comprometimento-futuro/page.tsx:158-232`; mais `lib/sobra.ts:427-489` e `page.tsx:358-407` (dashboard).
- Todas fazem `.from("compras_cartao").gte("data_compra", cutoff-60-meses)` — na prática a tabela inteira — e chamam `parcelaNoMes` por compra por mês. `parcelaNoMes` (`src/lib/cartao-calc.ts:650-692`) chama `valoresParcelas` (`:632`) que aloca um array de N parcelas a cada chamada. Em `fluxo-mensal` (12 meses) e `comprometimento-futuro` (12 meses) isso é 12 × compras × parcelas alocações.
- Cada page também recria objetos `CompraCartaoInfo`/`AssinaturaCartaoInfo` só para satisfazer o tipo (ex.: `fluxo-mensal/page.tsx:161-174`).

Ganho esperado: −700 linhas duplicadas; CPU de relatórios de 12 meses cai uma ordem de grandeza; abre caminho para mover a expansão de parcelas para o Postgres (ver (c)-4 e (d)).

Correção imediata (sem tocar no banco):
```ts
// src/lib/gastos-mes.ts
export type FonteGasto = "despesa" | "conta_fixa" | "compra_cartao" | "assinatura";
export type GastoMes = { id; fonte: FonteGasto; descricao; valor; categoria_id; quem_gastou; data; ref: unknown };
export function gastosDoMes(dados: DadosSaldo & { categorias?; membros? }, mes: MesRef): GastoMes[] { … }
```
Todos os relatórios passam a ser `gastosDoMes(dados, mes)` + um `reduce` específico. `parcelaNoMes` deve calcular `valor` aritmeticamente (`base` ou `ultima`) sem alocar array, e `restanteAposEste` só quando pedido.

### MÉDIO

#### M1. Waterfalls residuais em pages
- `src/app/(app)/despesas/page.tsx:37-67`: três ondas sequenciais — `await requireSession()` → `Promise.all(cartoes, categorias, membros)` → `Promise.all(atual, anterior)`. Devem ser uma só onda (as demais pages já fazem isso).
- `src/app/(app)/cartoes/[id]/page.tsx:71-108`: espera `cartao` para então buscar banco/compras/assinaturas. `compras`/`assinaturas` filtram por `cartao_id = id` (já conhecido pelos params) e `banco` pode vir por embed: `.select("id, banco_id, apelido, bandeira, dia_fechamento, dia_vencimento, ativo, bancos(id, nome, cor, icone)")`. Uma onda só.
- `src/lib/cartoes-selection.ts:779-792`: `cartoes` → `bancos.in(ids)` em série. Embed PostgREST resolve em 1 query: `.select("id, apelido, bancos(nome, cor, icone)")`. Este helper roda em TODAS as rotas (layout), então são 2 round-trips → 1 por navegação.

Ganho: −1 round-trip por navegação em todas as rotas; −2 em /despesas e /cartoes/[id].

#### M2. Dashboard: 14 requests PostgREST paralelos por render (`src/app/(app)/page.tsx:177-240`) + 3 do layout
Está paralelizado (bom), mas são 17 conexões HTTP simultâneas ao PostgREST por page view, cada uma passando por RLS (`current_casal_id()` → `profiles`). Para uso de casal é aceitável; se quiser reduzir latência de cauda, uma RPC `dashboard_mes(p_mes date)` retornando `jsonb` com os 10 conjuntos (`rendas`, `contas`, `lancamentos`, `cartoes+bancos`, `compras`, `assinaturas`, `dividas` com `pago` agregado, `pagamentos_fatura`) vira 1 round-trip. `dividas` + `pagamentos_divida` (`:227-228`) em particular deveriam ser uma view `dividas_saldo` (`sum(valor)` no banco) — o mesmo cálculo é repetido em `dividas/page.tsx:35-50` e `comprometimento-futuro/page.tsx:236-248`.

#### M3. `categorias/page.tsx:29-32` baixa `categoria_id` de TODAS as linhas de 4 tabelas só para contar uso
Quatro selects sem filtro (`contas_recorrentes`, `lancamentos`, `compras_cartao`, `assinaturas_cartao`) que crescem linearmente com o histórico. Substituir por view:
```sql
create view public.categorias_uso with (security_invoker = true) as
select categoria_id, count(*)::int as usos from (
  select categoria_id from public.lancamentos union all
  select categoria_id from public.contas_recorrentes union all
  select categoria_id from public.compras_cartao union all
  select categoria_id from public.assinaturas_cartao
) t where categoria_id is not null group by categoria_id;
```
Mesma ideia para `despesas/page.tsx:61-66` (`select("valor")` do mês anterior só para somar) e `bancos/page.tsx:21` (`cartoes.select("banco_id")` para contar).

#### M4. `revalidatePath` — listas longas, inconsistentes e duplicadas (sem ganho real de cache)
- Todas as rotas são dinâmicas; no Next 16 sem `cacheComponents` não há cache de página no servidor, e o Router Cache de segmentos dinâmicos tem `staleTime` 0. Logo `revalidatePath("/despesas")` chamado de `/despesas/actions.ts` serve apenas para atualizar a página atual — e as demais chamadas são ruído.
- Contagem: 120 chamadas em 13 arquivos. `cartoes/[id]/assinatura-actions.ts:107-196` repete o mesmo bloco de 4 paths em 5 funções; `categorias/actions.ts:30-34` lista 5 paths. E as listas são incompletas: `despesas/actions.ts:143-147` revalida `/relatorios/compras-do-mes` mas não `gastos-por-categoria`, `maiores-gastos`, `gastos-por-pessoa`, `renda-x-despesa`, `fluxo-mensal`, `categoria-por-mes` — funciona só porque nada está cacheado.

Correção pragmática hoje:
```ts
// src/lib/revalidar.ts
export function revalidarApp() { revalidatePath("/", "layout"); } // invalida tudo sob (app) numa chamada
```
Correção futura (quando/if adotar `cacheComponents: true` + `"use cache"` nos helpers de leitura): `cacheTag("lancamentos")`, `cacheTag("compras_cartao")`… e `updateTag("lancamentos")` na action correspondente — aí sim revalidação granular passa a ter efeito. Com dados por casal via cookie, o `"use cache"` precisaria receber `casalId` como argumento e usar client de serviço com filtro explícito, então avalie o custo antes.

#### M5. Índices (ver (d)) — os filtros de `tipo`, `ativa`, `casal_id+data_compra` e o `ilike` da busca global não têm índice adequado, e as policies RLS chamam `current_casal_id()` sem `(select …)`
- `supabase/migrations/0001_schema.sql:112-141` e demais: `using (casal_id = public.current_casal_id())`. Sem o wrapper `(select public.current_casal_id())` o Postgres pode reavaliar a função por linha em vez de uma vez por query (initPlan). É a otimização de RLS mais recomendada pelo próprio Supabase.
- Busca global (`src/components/search/actions.ts:84-113`): 6 queries `ilike '%termo%'` por tecla (debounce 300 ms) em tabelas sem índice trigram → seq scan em `lancamentos` e `compras_cartao`.

#### M6. Proxy roda para `/sw.js`, `/sounds/*.mp3` e `/manifest.webmanifest`
`src/proxy.ts:9-11` só exclui imagens. Cada fetch do service worker (o browser re-checa `sw.js` a cada navegação/24h) e do `coin.mp3` passa por `getClaims()` + possível `getUser()`. Adicionar `sw.js|sounds/|manifest.webmanifest|robots.txt` ao negative lookahead.

#### M7. Sem `Suspense` intra-página: o dashboard só pinta após as 14 queries
`page.tsx:142-240` faz tudo num único `await Promise.all`. `loading.tsx` cobre o caso, mas o conteúdo chega "tudo ou nada". Como a UI já é dividida em cards (`SobraMesHeroCard`, `DividasCard`, `FaturasCartaoCard`…), dá para streamar: hero + quinzenas primeiro (rendas/contas/lançamentos), e `<Suspense>` para `DividasCard` (2 queries) e `FaturasCartaoCard` (compras/assinaturas/pagamentos). Mesma ideia em `cartoes/[id]` (assinaturas em Suspense). Ganho: LCP do hero ~30–40% antes.

#### M8. Cron `api/cron/push-reminders/route.ts:136-176` faz 6 queries por casal em loop
N+1 por casal. Hoje há 1 casal; se virar multi-casal, trocar por 6 queries `.in("casal_id", ids)` fora do loop e agrupar em memória. Também recalcula `faturaDoMes` por cartão (ok).

### BAIXO

#### B1. TypeScript: nenhum tipo gerado do Supabase; 89 casts `as XRow[]` e strings de `select` sem checagem
Não existe `Database` type nem `createServerClient<Database>` (`src/lib/supabase/server.ts:181`). Cada page declara seu próprio `type LancamentoRow = {…}` (há ~8 variantes de `LancamentoRow`, 6 de `CompraRow`, 5 de `AssinaturaRow`), e um typo em `select("data_referencia, …")` só aparece em runtime como `undefined`.
```bash
npx supabase gen types typescript --project-id <ref> --schema public > src/lib/supabase/database.types.ts
```
```ts
import type { Database } from "./database.types";
export async function createClient() { return createServerClient<Database>(url, key, {...}); }
// resultado: supabase.from("lancamentos").select("id, valor") já vem tipado; apagar os casts
// e as ~25 declarações XRow locais; usar Tables<"lancamentos"> / Pick<…> onde precisar.
```
Ganho: −300 linhas de tipos duplicados; erros de coluna em build; autocomplete nos `select`.

#### B2. `parcelaNoMes` aloca array a cada chamada (`src/lib/cartao-calc.ts:671,681`)
`valoresParcelas` cria `Array(parcelas)` e `restanteAposEste` faz `slice().reduce` sempre, mesmo quando o chamador só quer `valor`. Cálculo direto: `valor = meses === parcelas-1 ? ultima : base`, `restante = (parcelas-1-meses)*base + (meses < parcelas-1 ? ultima : 0)`.

#### B3. Dialogs em listas usam `useMemo` com 7 dependências para `defaults` (`despesa-form-dialog.tsx:101-122`) — desnecessário se A2 for aplicado (o dialog passa a existir só enquanto aberto).

#### B4. `hojeISO()` (`src/lib/mes.ts:295`) chama `toLocaleDateString` com `timeZone` (cria um `Intl.DateTimeFormat` por chamada). É chamado várias vezes por render (page.tsx:150, saudacaoContexto:1357, dialogs). Hoist `new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })` no módulo.

#### B5. Manifest/PWA
- `src/app/manifest.ts:44-56`: só um ícone 512 `purpose: "any"`; falta `192x192` e um `purpose: "maskable"` — Android recorta o ícone e o Lighthouse PWA reclama. Como `/icon` é gerado por `ImageResponse`, basta exportar `generateImageMetadata` com dois tamanhos ou adicionar `apple-icon` 180 como 192.
- `public/sw.js`: sem handler de `fetch` → nenhum cache, nenhum offline, mas também **nenhum risco de servir JS antigo após deploy** (ponto positivo dado o item 8 da missão). Se um dia adicionar cache, versionar por `BUILD_ID` e nunca cachear `/_next/static` com `cache-first` sem hash no nome.
- Fontes: `next/font/google` (Figtree 4 pesos + Caprasimo) self-hosted no build — ok. `src/app/_fonts/Caprasimo-Regular.ttf` (41 KB) só é lido em `icon.tsx`/`apple-icon.tsx` (server) — não vai ao cliente. `coin.mp3` (63 KB) só carrega no primeiro `play()` — ok.

#### B6. `lucide-react`: 29 ícones únicos, todos importados por nome (tree-shake ok). `bancos-icones.tsx` tem 107 linhas com SVG inline — sem impacto.

#### B7. Chunk de `/relatorios/compras-do-mes` é o maior (+56 KB raw sobre os outros relatórios) porque `relatorio-client.tsx:19-38` importa 4 form-dialogs + 4 actions-menus. Aceitável; com A2 e a abstração (c)-2 cai naturalmente.

---

## (c) Refatorações arquiteturais recomendadas (ordem custo/benefício)

1. **Lazy-load dos dialogs globais + layout não-bloqueante** (A1 + A4). Custo: ~2 h. Benefício: −60–80 KB gz em todas as rotas, shell instantânea. É a mudança de maior retorno por linha alterada.

2. **`withSession()` + defaults `casal_id`/`criado_por` no banco + `Promise.all` nas actions** (A3). Custo: ~3 h (13 arquivos + 1 migration). Benefício: mutações 2–3× mais rápidas; elimina 17 blocos idênticos de ~12 linhas (−200 linhas).

3. **Abstração dos pares form-dialog / actions-menu / actions** (item 9 da missão). Métricas atuais: 15 form-dialogs = 3.888 linhas; 12 actions-menus = 854 linhas; 13 arquivos de actions = 1.841 linhas; 12 `parseFormData` artesanais; 10 usos de `useResetAoAbrir`; 15 de `useActionState` com o mesmo wrapper (fechar + toast + som). Propostas concretas:
   - `useFormDialog({ action, isEdit, mensagens })` (client): encapsula `open`, `useActionState` wrapper (`despesa-form-dialog.tsx:88-99` está copiado 15×), `toast`, `playCoinSound`, `useResetAoAbrir`. −25 linhas × 15.
   - `<FormDialogShell title description trigger footer>`: cabeçalho/rodapé/`form key={open}` idênticos em todos (`despesa-form-dialog.tsx:173-200, 429-453`). −40 linhas × 15.
   - `<EntityActionsMenu items={[{label, icon, onSelect}]} destructive={{label, title, description, action}} />`: os 12 menus diferem só na lista de itens (`despesa-actions-menu.tsx` vs `recorrente-actions-menu.tsx` são 90% iguais). 854 → ~250 linhas.
   - `parseForm(schema, formData)` com **zod** (não está instalado; +13 KB só no server, zero no cliente) ou um mini-schema próprio: substitui os 12 `parseFormData` (`despesas/actions.ts:41-92`, `recorrentes/actions.ts:24-56`…) e padroniza mensagens. Exemplo:
     ```ts
     const DespesaSchema = z.object({
       descricao: z.string().trim().min(1, "Descrição é obrigatória."),
       valor: z.string().transform(parseBRLInput).pipe(z.number().positive("Valor deve ser maior que zero.")),
       data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
       quinzena: z.coerce.number().pipe(z.union([z.literal(15), z.literal(30)])),
       categoria_id: z.string().trim().optional().default(""),
     });
     ```
   - `revalidarApp()` (M4): −110 chamadas.
   Estimativa total: **−1.500 a −2.000 linhas (≈35–40% desses arquivos)** e 1 lugar para corrigir bugs de formulário em vez de 15. Custo: 1–2 dias.

4. **Um único dialog por lista via Provider** (A2). Custo: ~1 dia (10 pages). Benefício: payload RSC e hidratação de listas −50–70%; combina com o item 3.

5. **`gastosDoMes()` compartilhado + view/RPC de parcelas** (A5). Fase 1 (JS, ~4 h): extrai a agregação para `src/lib/gastos-mes.ts`, relatórios viram 30–60 linhas cada. Fase 2 (SQL, ~4 h): função `public.parcelas_no_mes(p_mes date)` que expande `compras_cartao` com `generate_series` e devolve `(compra_id, cartao_id, numero, valor, categoria_id, quem_gastou)` só do mês pedido — os relatórios param de baixar a tabela inteira e a regra de "dia de fechamento" fica num lugar só (hoje está em `cartao-calc.ts:617` e é replicada implicitamente em 10 chamadas).

6. **Tipos gerados do Supabase** (B1). Custo: ~3 h para gerar e substituir casts. Benefício: segurança de tipo; menos 300 linhas.

7. **Streaming intra-página com Suspense** no dashboard e `cartoes/[id]` (M7). Custo: ~3 h. Benefício: LCP do hero ~30–40% mais cedo.

8. **RPC `dashboard_mes`** (M2) e views `dividas_saldo`/`categorias_uso` (M3). Custo: ~4 h. Benefício: 17 → ~4 requests por render do dashboard; `categorias` deixa de crescer com o histórico.

9. **`cacheComponents` + `"use cache"`/`cacheTag`/`updateTag`** — só depois dos itens 1–5; hoje não há o que cachear com segurança por causa do escopo por cookie.

---

## (d) Índices SQL sugeridos

```sql
-- 1) RLS: avaliar current_casal_id() uma vez por query (initPlan), não por linha.
--    Reescrever TODAS as policies *_scope trocando
--      using (casal_id = public.current_casal_id())
--    por
--      using (casal_id = (select public.current_casal_id()))
--    (idem no with check). Exemplo:
drop policy if exists "lancamentos_scope" on public.lancamentos;
create policy "lancamentos_scope" on public.lancamentos for all to authenticated
  using (casal_id = (select public.current_casal_id()))
  with check (casal_id = (select public.current_casal_id()));

-- 2) lancamentos: todas as leituras filtram tipo + faixa de data_referencia
--    (page.tsx:208-215, despesas/page.tsx:52-66, rendas/page.tsx:57-65, relatórios *:in("tipo") + gte/lte)
create index if not exists lancamentos_casal_tipo_data_idx
  on public.lancamentos (casal_id, tipo, data_referencia desc);
-- opcional: a data_ref_idx (casal_id, data_referencia) fica redundante se a de cima existir; manter só uma.

-- 3) compras_cartao: dashboard/relatórios filtram por casal (RLS) + data_compra;
--    o índice existente é (cartao_id, data_compra) e não serve para esse plano.
create index if not exists compras_cartao_casal_data_idx
  on public.compras_cartao (casal_id, data_compra desc);
-- relatorio compras-parceladas usa .gt("parcelas", 1):
create index if not exists compras_cartao_parceladas_idx
  on public.compras_cartao (casal_id, data_compra desc) where parcelas > 1;

-- 4) Filtros "ativa/ativo = true" (contas_recorrentes, assinaturas_cartao, cartoes, rendas)
create index if not exists contas_recorrentes_ativas_idx
  on public.contas_recorrentes (casal_id, quinzena, dia_vencimento) where ativa;
create index if not exists assinaturas_cartao_ativas_idx
  on public.assinaturas_cartao (casal_id, cartao_id) where ativa;
create index if not exists cartoes_ativos_idx
  on public.cartoes (casal_id) where ativo;
create index if not exists rendas_ativas_idx
  on public.rendas (casal_id, dia_recebimento) where ativa;

-- 5) Busca global (ilike '%termo%') — trigram nas duas tabelas que crescem
create extension if not exists pg_trgm;
create index if not exists lancamentos_descricao_trgm_idx
  on public.lancamentos using gin (descricao gin_trgm_ops);
create index if not exists compras_cartao_descricao_trgm_idx
  on public.compras_cartao using gin (descricao gin_trgm_ops);

-- 6) Contagem de uso de categorias sem varrer tabelas no app (M3)
create or replace view public.categorias_uso with (security_invoker = true) as
select categoria_id, count(*)::int as usos from (
  select categoria_id from public.lancamentos
  union all select categoria_id from public.contas_recorrentes
  union all select categoria_id from public.compras_cartao
  union all select categoria_id from public.assinaturas_cartao
) t where categoria_id is not null group by categoria_id;

-- 7) Saldo de dívidas agregado (usado em /, /dividas, /relatorios/comprometimento-futuro)
create or replace view public.dividas_saldo with (security_invoker = true) as
select d.id, d.casal_id, d.descricao, d.valor_total,
       coalesce(sum(p.valor), 0) as pago,
       greatest(d.valor_total - coalesce(sum(p.valor), 0), 0) as restante
from public.dividas d
left join public.pagamentos_divida p on p.divida_id = d.id
group by d.id;

-- 8) Defaults que eliminam a query em profiles nas actions (A3)
alter table public.lancamentos
  alter column casal_id set default public.current_casal_id(),
  alter column criado_por set default auth.uid();
-- repetir para: contas_recorrentes, compras_cartao, assinaturas_cartao (criada_por), dividas,
-- pagamentos_divida, pagamentos_fatura, compras_futuras, rendas, bancos, cartoes, categorias,
-- push_subscriptions (profile_id default auth.uid()).
```

Índices já existentes e adequados: `lancamentos(casal_id, data_referencia)`, `lancamentos_recorrente_mes_unico (conta_recorrente_id, data_referencia)`, `pagamentos_fatura(casal_id, mes_referencia)`, `pagamentos_divida(divida_id, data_pagamento)`, `compras_futuras(casal_id, prioridade)`, todos os `*_casal_id_idx` e `*_categoria_id_idx`.

---

## Resumo (≤ 12 linhas)

1. Build OK (Next 16.3, Turbopack, 11,6 s, zero warnings); todas as rotas `(app)` dinâmicas. First Load JS: 229–256 KB gz em toda rota do app (dashboard 231 KB, `/relatorios/compras-do-mes` 256 KB, login 152 KB) — ~105 KB são React/Next, ~70 KB Base UI/floating-ui/sonner.
2. **ALTO** — `(app)/layout.tsx` monta `DespesaFormDialog` (FAB) e `GlobalSearchDialog` em toda rota: lazy-load via `next/dynamic` corta ~60–80 KB gz do bundle inicial.
3. **ALTO** — layout bloqueia a shell até sessão + 4 queries (`getCartoesParaSelecao` são 2 em série); mover o FAB para `<Suspense>` e usar embed PostgREST.
4. **ALTO** — 1 form-dialog completo por linha nas listas (9 useState + props `categorias/membros` serializadas N vezes); um dialog por página via Provider.
5. **ALTO** — server actions com 5 round-trips sequenciais (`getUser` de rede + `profiles` + 2 lookups + insert) em 17 lugares; `withSession()` + defaults `casal_id`/`criado_por` no banco + `Promise.all` → 1–2 round-trips.
6. **ALTO** — agregação de gastos copiada 8× nos relatórios, sempre baixando `compras_cartao` inteira e alocando arrays por compra×mês; extrair `gastosDoMes()` e depois RPC `parcelas_no_mes` em SQL.
7. **MÉDIO** — waterfalls em `/despesas` (3 ondas) e `/cartoes/[id]` (2 ondas); dashboard com 17 requests paralelos (RPC `dashboard_mes` opcional); `/categorias` varre 4 tabelas para contar uso (view).
8. **MÉDIO** — 120 `revalidatePath` inconsistentes sem efeito de cache (rotas dinâmicas): substituir por `revalidatePath("/", "layout")` único; `updateTag` só faz sentido com `cacheComponents`.
9. **MÉDIO** — RLS sem `(select current_casal_id())`, falta índice `(casal_id, tipo, data_referencia)`, `(casal_id, data_compra)`, parciais `where ativa`, trigram para a busca; proxy roda em `/sw.js` e `/sounds`.
10. **BAIXO** — sem tipos gerados do Supabase (89 casts, ~25 tipos Row duplicados): `supabase gen types`; manifest sem ícone 192/maskable; SW sem cache (sem risco de JS velho).
11. Duplicação: 15 form-dialogs (3.888 linhas), 12 actions-menus (854), 13 actions (1.841), 12 `parseFormData`; `useFormDialog` + `FormDialogShell` + `EntityActionsMenu` + `parseForm(zod)` economizam ~1.500–2.000 linhas.
12. Ordem sugerida: lazy dialogs + layout não-bloqueante → `withSession` + defaults SQL → abstrações de dialog/menu/actions → dialog único por lista → `gastosDoMes` + RPC → tipos gerados → Suspense no dashboard → índices/RLS (podem ir a qualquer momento, migration isolada).
