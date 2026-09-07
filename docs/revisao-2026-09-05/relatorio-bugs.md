# Relatório de bugs de correção — Financeiro do Casal

Escopo: lógica de datas/quinzena, cálculos financeiros, Server Actions, estados de UI, consistência com o schema SQL, service worker/push, busca global e edge cases. Todos os itens da seção "Bugs confirmados" foram verificados lendo o código-fonte (e, no caso do cron, também executando uma requisição contra o `next dev` que já estava rodando na porta 3000).

Ferramentas:
- `npx tsc --noEmit` → **0 erros**.
- `npm run lint` (eslint) → **0 erros, 16 warnings** (detalhe no final).

Caminhos são relativos a `C:\Users\bruno\Documents\Financeiro\couple-finance-tracker`.

---

## CRÍTICO

### 1. O cron de lembretes push nunca executa: o `proxy.ts` redireciona `/api/cron/push-reminders` para `/login`

- **Arquivos:** `src/proxy.ts:8-12`, `src/lib/supabase/middleware.ts:4-10` e `:72-76`, `vercel.json` (crons), `src/app/api/cron/push-reminders/route.ts:93-97`.
- **O que acontece:** o matcher do proxy (`/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|...)$).*)`) inclui `/api/...`. `updateSession` só considera públicos `/login`, `/auth`, `/manifest.webmanifest`, `/icon`, `/apple-icon`. A requisição do Vercel Cron não tem cookie de sessão Supabase (só o header `Authorization: Bearer CRON_SECRET`, que o client Supabase ignora), então `authed = false` e o proxy devolve `307 → /login` antes de o Route Handler rodar. A verificação do `CRON_SECRET` na linha 94 do route nunca é alcançada.
- **Confirmação empírica** (servidor `next dev` já em execução na porta 3000):
  ```
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/push-reminders
  → status=307 location=http://localhost:3000/login
  ```
- **Efeito:** nenhum lembrete de conta/fatura é enviado em produção; o cron "0 12 * * *" recebe 307 todo dia. Subscriptions expiradas (404/410) também nunca são limpas.
- **Correção sugerida** (qualquer uma das duas):
  ```ts
  // src/lib/supabase/middleware.ts
  const PUBLIC_PATHS = ["/login", "/auth", "/manifest.webmanifest", "/icon", "/apple-icon", "/api/cron"];
  ```
  ou excluir a API do matcher (o próprio doc do Next sugere isso):
  ```ts
  // src/proxy.ts
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
  ```

---

## ALTO

### 2. "Fatura do mês" ignora a relação fechamento → vencimento; cartões com vencimento antes do fechamento (ex.: fecha 28, vence 5) caem no mês errado em todo o app

- **Arquivos:** `src/lib/cartao-calc.ts:50-66` (`mesPrimeiraParcela`), `:91-133` (`parcelaNoMes`), `:139-192` (`faturaDoMes`), `:199-201` (`quinzenaDoCartao`); consumidores: `src/app/(app)/page.tsx:294-324` e `:1173`, `src/lib/sobra.ts:97-111`, `src/app/api/cron/push-reminders/route.ts:210-239`, todos os relatórios.
- **Causa:** `mesPrimeiraParcela` decide o mês da fatura só pelo `dia_fechamento` e assume, no comentário, que a fatura que fecha no mês M "é paga esse mês". Isso só vale quando `dia_vencimento > dia_fechamento`. Para o padrão mais comum no Brasil (fecha ~7 dias antes de vencer, atravessando a virada do mês), a fatura que fecha em M vence em M+1. O `dia_vencimento` nunca entra no cálculo do mês — só na quinzena.
- **Cenário concreto:** cartão fecha dia 25, vence dia 5. Compra de R$ 300 em 10/ago.
  - Código: parcela cai na "fatura de Agosto", quinzena 15 de agosto ("Vence dia 5"); a partir de 6/ago o dashboard marca **"Venceu dia 5"** — a fatura nem fechou ainda.
  - Realidade: fatura fecha 25/ago e vence **5/set**. A sobra de agosto fica R$ 300 menor do que é, e a de setembro R$ 300 maior.
  - Cron (`route.ts:215-229`): para o vencimento 5/set ele calcula `faturaDoMes(setembro)` = compras de 26/ago a 25/set (ainda no futuro) e avisa um valor errado; a fatura real (26/jul–25/ago) fica sem lembrete.
  - `pagamentos_fatura.mes_referencia` e o link `/cartoes/{id}?mes=` herdam a mesma confusão.
- **Correção sugerida:** o "mês da fatura" deve ser o mês do **vencimento**. `mesPrimeiraParcela` precisa receber o cartão inteiro:
  ```ts
  export function mesPrimeiraParcela(dataCompraISO: string, cartao: Pick<CartaoInfo, "dia_fechamento" | "dia_vencimento">): MesRef {
    const [ano, mes, dia] = dataCompraISO.split("-").map(Number);
    let alvo = dia <= cartao.dia_fechamento ? mes : mes + 1;        // mês em que a fatura FECHA
    if (cartao.dia_vencimento <= cartao.dia_fechamento) alvo += 1;   // vence no mês seguinte ao fechamento
    return buildMes(ano + Math.floor((alvo - 1) / 12), ((alvo - 1) % 12) + 1);
  }
  ```
  e propagar `dia_vencimento` para `parcelaNoMes` e para os call sites (`compra-form-dialog.tsx:213`, `search/actions.ts:174`, relatórios que usam `cartao?.dia_fechamento ?? 1`).

### 3. Relatórios "Gastos por categoria" e "Categoria mês a mês": conta fixa **paga** vira "Sem categoria"

- **Arquivos:** `src/app/(app)/relatorios/gastos-por-categoria/page.tsx:156`, `src/app/(app)/relatorios/categoria-por-mes/page.tsx:116`; origem: `src/app/(app)/pagar/actions.ts:40-50`.
- **Causa:** `pagarContaRecorrente` insere o lançamento sem `categoria_id`/`categoria`/`quem_gastou`. Esses dois relatórios fazem `const categoriaId = pago ? pago.categoria_id : c.categoria_id;` — quando existe pagamento, usam o `categoria_id` do lançamento, que é sempre `null`. (`compras-do-mes/page.tsx:179` e `maiores-gastos/page.tsx:162` já fazem `pago?.categoria_id ?? c.categoria_id`, correto.)
- **Cenário concreto:** "Aluguel" R$ 1.500 na categoria "Moradia". Ao clicar em "Pagar" no dashboard, "Moradia" some/zera em Gastos por categoria e a linha "Sem categoria" ganha R$ 1.500. Categoria mês a mês mostra a categoria "sumindo" em todos os meses já pagos.
- **Correção sugerida:** nos dois relatórios usar `pago?.categoria_id ?? c.categoria_id`; e/ou em `pagarContaRecorrente` copiar `categoria_id`, `categoria` e `quem_gastou` da conta recorrente para o lançamento (1 select a mais).

---

## MÉDIO

### 4. `valoresParcelas` distribui as parcelas errado por imprecisão de ponto flutuante (soma bate, mas a última parcela fica maior)

- **Arquivo:** `src/lib/cartao-calc.ts:73-85`.
- **Causa:** `Math.floor((valorTotal * 100) / parcelas)`: `1.15 * 100 = 114.99999999999999` → floor cai um centavo por parcela; a diferença acumulada vai toda para a última.
- **Cenários (rodados em Node):**
  - R$ 1,15 em 5x → `[0,22, 0,22, 0,22, 0,22, 0,27]` (esperado 0,23 × 5)
  - R$ 8,20 em 4x → `[2,04, 2,04, 2,04, 2,08]` (esperado 2,05 × 4)
  - R$ 4,35 em 3x → `[1,44, 1,44, 1,47]` (esperado 1,45 × 3)
  - R$ 2,30 em 10x → `0,22 × 9 + 0,32`
  Afeta fatura por mês, "Falta pagar", comprometimento futuro e o preview do form.
- **Correção sugerida:** trabalhar em centavos inteiros desde o início:
  ```ts
  export function valoresParcelas(valorTotal: number, parcelas: number): number[] {
    const cents = Math.round(valorTotal * 100);
    if (parcelas <= 1) return [cents / 100];
    const base = Math.floor(cents / parcelas);
    const ultima = cents - base * (parcelas - 1);
    return [...Array(parcelas - 1).fill(base / 100), ultima / 100];
  }
  ```

### 5. `parseBRLInput("1.500")` retorna 1,5 (ponto de milhar sem vírgula vira decimal)

- **Arquivo:** `src/lib/format.ts:14-23`. Usado por todas as actions de valor (`despesas`, `recorrentes`, `rendas`, `cartoes/[id]`, `dividas`, `pagar`, `compras-futuras`).
- **Cenário:** usuário digita "1.500" (formato brasileiro sem centavos) no aluguel → salva **R$ 1,50** sem nenhum aviso (passa no `> 0`). Também aceita `"1e3"` → 1000, `"0x10"` → 16 e `" "` → 0.
- **Correção sugerida:**
  ```ts
  const semMoeda = input.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  let normalized: string;
  if (semMoeda.includes(",")) normalized = semMoeda.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(semMoeda)) normalized = semMoeda.replace(/\./g, ""); // 1.500 / 12.345
  else normalized = semMoeda;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null; // rejeita 1e3, 0x10, vazio, negativo
  return Number(normalized);
  ```

### 6. Lançamento de conta fixa já paga some dos totais quando a conta é desativada, excluída ou perde a vigência

- **Arquivos:** `src/lib/sobra.ts:75-96` e `:112-117` (só soma contas em `dados.contas`, que vêm com `ativa = true`; `totalDespesas` só `despesa_avulsa`), `src/lib/sobra.ts:160-164`, `src/app/(app)/page.tsx:202-207` e `:359-407`, `relatorios/fluxo-mensal/page.tsx:95-98,146-156`, `renda-x-despesa/page.tsx:126-134`, `gastos-por-categoria`, `categoria-por-mes`, `compras-do-mes`, `maiores-gastos`, `gastos-por-pessoa` (mesmo padrão). Schema: `supabase/migrations/0001_schema.sql:72` (`conta_recorrente_id ... on delete set null`).
- **Cenário concreto:** "Academia" R$ 100 marcada como paga em setembro. Em outubro o casal desativa (ou exclui) a conta. Ao voltar para setembro: "Contas" cai R$ 100, a Sobra de setembro sobe R$ 100, o relatório de fluxo mensal muda retroativamente — mas o lançamento de R$ 100 continua no banco (com `conta_recorrente_id = null` no caso de exclusão) e não aparece em lugar nenhum. O histórico é reescrito silenciosamente.
- **Correção sugerida:** tratar todo lançamento `conta_fixa` do mês como gasto, independente da definição atual da conta:
  ```ts
  // em calcularSaldoMes e nos relatórios: contas vigentes usam (pago ?? previsto) como hoje,
  // e os lançamentos conta_fixa cujo conta_recorrente_id NÃO está em contasMes entram pelo valor real:
  const idsVigentes = new Set(contasMes.map((c) => c.id));
  const orfaos = lancsMes.filter((l) => l.tipo === "conta_fixa" && (!l.conta_recorrente_id || !idsVigentes.has(l.conta_recorrente_id)));
  totalContasRec += orfaos.reduce((s, l) => s + Number(l.valor), 0);
  ```

### 7. "Contas da quinzena" e o alerta de atraso só olham a quinzena atual: contas vencidas da quinzena 15 desaparecem a partir do dia 16

- **Arquivo:** `src/app/(app)/page.tsx:437-438` (`quinzenaAtual`), `:449-455` (`contasEmAtraso` só em `quinzenaAtualDados.contas`), `:550-556` (card recebe só `quinzenaAtualDados.contas`).
- **Cenário concreto:** dia 20/set. "Luz" (quinzena 15, vence dia 10) não foi paga. O dashboard não a lista no checklist, não mostra o banner "A luz venceu" e o contador "x de y pagas" ignora a pendência. A conta só volta a aparecer no mês seguinte (já como outra ocorrência).
- **Correção sugerida:** no `contasEmAtraso` e no card, usar `contasVigentesNoMes(mes)` inteiras (ou `q15.contas ∪ q30.contas`), destacando a quinzena atual e mantendo as pendentes/vencidas da outra quinzena visíveis.

### 8. Na página do cartão, editar (ou criar pelo estado vazio) uma assinatura não permite escolher categoria

- **Arquivo:** `src/app/(app)/cartoes/[id]/page.tsx:382` (`<AssinaturaFormDialog cartaoId=... membros=... />`) e `:430-434` (`<EditAssinaturaTrigger assinatura cartaoId membros />`) — `categorias` não é passado; o dialog usa o default `[]` (`assinatura-form-dialog.tsx:59`).
- **Cenário:** ao editar a "Netflix", o select mostra "Sem categoria / Nenhuma cadastrada ainda. Criar categoria" mesmo com categorias existentes; a categoria atual continua no hidden input (não é perdida), mas não dá para trocar. O botão "Nova assinatura" do header (`:180-184`) passa `categorias` e funciona; o do estado vazio não.
- **Correção:** adicionar `categorias={categorias}` nas duas chamadas.

### 9. Marcar a mesma conta como paga duas vezes mostra erro cru do Postgres

- **Arquivos:** `src/app/(app)/pagar/actions.ts:40-54`; índice `lancamentos_recorrente_mes_unico` em `supabase/migrations/0001_schema.sql:81-83`.
- **Cenário:** o parceiro já marcou "Aluguel" como pago (ou a página ficou aberta em duas abas). Ao confirmar, o usuário vê `duplicate key value violates unique constraint "lancamentos_recorrente_mes_unico"` dentro do dialog, e o dashboard não é revalidado (o `return` acontece antes do `revalidatePath`).
- **Correção sugerida:**
  ```ts
  if (error) {
    if (error.code === "23505") { revalidatePath("/"); return { error: "Essa conta já está marcada como paga neste mês." }; }
    return { error: error.message };
  }
  ```
  (mesmo tratamento que `categorias/actions.ts:61-65` já faz.)

### 10. Busca global: respostas fora de ordem sobrescrevem o resultado mais novo

- **Arquivo:** `src/components/search/global-search-dialog.tsx:56-73`.
- **Causa:** o debounce cancela o timer, mas não invalida a requisição já disparada. Digitar "mer" (busca A lenta) e depois "mercado" (busca B rápida): B chega, depois A chega e `setResultados(res)` troca a lista pelos resultados de "mer".
- **Correção sugerida:** guardar um contador/`termo` no ref e ignorar respostas cujo termo ≠ `texto` atual:
  ```ts
  const seq = ++seqRef.current;
  const res = await buscarGlobal(texto);
  if (seq === seqRef.current) setResultados(res);
  ```

---

## BAIXO

### 11. Excluir banco com cartões vinculados exibe mensagem crua de FK
- `src/app/(app)/bancos/actions.ts:73-79`; schema `cartoes.banco_id ... on delete restrict` (`0002_cartoes.sql:173`). O toast mostra `update or delete on table "bancos" violates foreign key constraint ...`. Mapear `error.code === "23503"` → "Exclua ou mova os cartões deste banco antes."

### 12. Toggles ativar/desativar ignoram o resultado da action e sempre mostram sucesso
- `src/app/(app)/cartoes/cartao-actions-menu.tsx:23-28`, `cartoes/[id]/assinatura-actions-menu.tsx:45-50`, `recorrentes/recorrente-actions-menu.tsx:27-32`, `rendas/renda-actions-menu.tsx:27-32`. Se o `update` falhar (rede/RLS), o usuário vê "Cartão desativado." e nada mudou. Verificar `result?.error` como os `ConfirmDialog` já fazem.

### 13. "Encerrar hoje" numa assinatura futura viola o check `fim_vigencia >= inicio_vigencia`
- `src/app/(app)/cartoes/[id]/assinatura-actions.ts:185-197`; menu mostra a opção quando `ativaHoje` = ativa **no mês selecionado** (`page.tsx:389-392`, `assinatura-actions-menu.tsx:72-77`). Cenário: hoje 5/set, assinatura começa 15/out, usuário navega para outubro e clica "Encerrar hoje" → `fim_vigencia = 2026-09-05 < inicio` → erro cru de constraint. Usar `max(hoje, inicio_vigencia)` ou esconder a opção quando `inicio_vigencia > hoje`.

### 14. `contas_recorrentes.inicio_vigencia` usa `current_date` do Postgres (UTC), não a data de Brasília
- `supabase/migrations/0001_schema.sql:53`; `src/app/(app)/recorrentes/actions.ts:96-102` não envia `inicio_vigencia`. Conta criada entre 21:00 e 23:59 (BRT) no último dia do mês recebe `inicio_vigencia` do dia 1 do mês seguinte e não aparece no mês corrente (filtro `inicio_vigencia <= ultimoDia`). Enviar `inicio_vigencia: hojeISO()` na action (como `assinatura-actions.ts:29-31` já faz).

### 15. Relatório "Gastos por pessoa": `quem_gastou` com uuid de profile inexistente reseta o grupo "Não especificado" a cada item
- `src/app/(app)/relatorios/gastos-por-pessoa/page.tsx:157-174`. Para `key` = uuid desconhecido (ex.: profile do parceiro removido — `quem_gastou` é texto sem FK, `0010_quem_gastou.sql`), `grupoAgg.get(key)` sempre falha e o código faz `grupoAgg.set(NAO_ESPECIFICADO, novoGrupo(...))`, zerando o acumulado anterior. Só o último item desse tipo é contado. Buscar/definir o grupo por `NAO_ESPECIFICADO`, não por `key`.

### 16. "Comprei" sem transação: se a despesa é criada e o `update comprado_em` falha, reenviar duplica a despesa
- `src/app/(app)/compras-futuras/actions.ts:176-203`. Fazer o update primeiro (ou uma RPC), ou inserir a despesa só depois do `comprado_em`.

### 17. Dashboard esconde as despesas avulsas quando não há renda, conta nem cartão
- `src/app/(app)/page.tsx:444-448` (`nenhumDado` não considera `totalDespesas`/`lancamentos.length`). Casal que só lançou despesas vê "Ainda não tem nenhuma renda ou conta cadastrada" e nenhuma despesa.

### 18. Busca global: link de compra "em andamento" leva a um mês onde a compra não aparece
- `src/components/search/actions.ts:171-175` usa `mesPrimeiraParcela` (parcela 1), mas `parcelaNoMes` pula `parcelas_ja_pagas` (`cartao-calc.ts:110`). Compra cadastrada "na parcela 4" abre `/cartoes/{id}?mes=<mês da parcela 1>` → "Nenhuma compra cai na fatura". Somar `parcelas_ja_pagas` meses ao link.

### 19. Service worker: clique na notificação foca qualquer aba em vez de abrir a URL do payload
- `public/sw.js:22-28`: `c.url.includes(url)` com `url = "/"` casa com qualquer aba do app; e para `/cartoes/{id}` abre uma segunda janela em vez de navegar a existente. Usar `c.navigate(url)` após `focus()`.

### 20. Cron engole falhas de envio que não são 404/410 e responde `ok: true`
- `src/app/api/cron/push-reminders/route.ts:263-268`: erro 401/403 (VAPID errado) ou 413 não é logado nem contado; o JSON diz `enviados: 0` sem indicar falha. Logar `err` e devolver `falhas`.

### 21. Botão de sino diz "ativado" mesmo quando o servidor já descartou a subscription
- `src/components/push/push-toggle-button.tsx:40-42` lê só `pushManager.getSubscription()`. Se o cron apagou a linha (410) ou o `subscribePush` falhou depois do `subscribe()` do browser, a UI mostra ativo e nada chega. Fazer o `subscribePush` de novo quando houver subscription local (upsert é idempotente) ou consultar o servidor.

### 22. Texto quebrado no card de dívidas
- `src/app/(app)/page.tsx:978-981` renderiza "+outras não mostradas" / "+ não mostradas" (o template `+{... ? "outras" : ""} não mostradas` nunca inclui a quantidade). Mostrar `+{dividasAbertas.length - 3} outras`.

---

## Lint / tipos

`npx tsc --noEmit`: 0 erros.

`npm run lint`: 0 erros, 16 warnings — código morto e deps de hooks:
- `@typescript-eslint/no-unused-vars`: `iniciais` (`cartoes/[id]/page.tsx:46`), `Badge` (`despesas/page.tsx:8`), `Card` (`relatorios/page.tsx:16`), `error` (`app/(app)/error.tsx:4`).
- `react-hooks/exhaustive-deps` (12): `useMemo` com dependência desnecessária `x.id` em todos os form-dialogs; dependência faltando `banco` (`bancos/banco-form-dialog.tsx:80`) e `bancos` + expressão complexa `bancos[0]?.id` (`cartoes/cartao-form-dialog.tsx:90,98`). Nenhum causa bug observável hoje (os `defaults` só mudam quando a row muda), mas o de `cartao-form-dialog` pode manter `banco_id` de um banco excluído como default.

---

## Suspeitas não confirmadas

- **`revalidatePath` incompleto** em `pagar/actions.ts` (só `/`), `rendas/actions.ts` (não inclui `/relatorios/*`), `dividas/[id]/actions.ts` (não inclui `/relatorios/comprometimento-futuro`). Como todas as páginas usam `cookies()`/`searchParams` e são dinâmicas, não confirmei dado obsoleto visível ao usuário no Next 16; pode aparecer só com o Router Cache do cliente em navegações rápidas.
- **Hydration mismatch perto da meia-noite**: `hojeISO()` é chamado no render de client components (`pagar-dialog.tsx:62`, `despesa-form-dialog.tsx:102`, `comprei-dialog.tsx:55`) — SSR e cliente podem calcular datas diferentes entre 23:59 e 00:00, gerando warning de hidratação e `defaultValue` divergente. Não reproduzido.
- **Compra em andamento editada meses depois**: `compra-form-dialog.tsx:161-183` recalcula `data_compra` relativo a *hoje* ao mexer em "Estou na parcela"; editar em outubro uma compra cadastrada em setembro e tocar no campo desloca todo o cronograma. É consequência do design, não uma falha de código isolada.
- **`calcularDataCompraRetro` usa `toISOString()` (UTC)** (`compra-form-dialog.tsx:78-85`): testei com `TZ=America/Sao_Paulo` e o resultado é correto (UTC-3 mantém a data); só erraria em fusos UTC+ (dia 1 viraria dia 30/31 do mês anterior). Não afeta o casal.
- **Push: dois dispositivos do mesmo casal recebem N × payloads** — é intencional pelo comentário da migration, mas se o cron for disparado mais de uma vez no mesmo dia (retry do Vercel) as notificações duplicam; não há deduplicação por dia.
