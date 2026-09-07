# Revisão completa — Financeiro do Casal (05/09/2026)

Time de 5 agentes: bugs, segurança, performance/arquitetura, produto e UI/UX (teste real no Chrome em 375, 360, 768, 1024 e 1366 px, tema claro e escuro). Nenhum arquivo de código foi alterado. Relatórios completos nesta pasta:

| Arquivo | Conteúdo |
|---|---|
| `relatorio-bugs.md` | 22 bugs confirmados + lint + suspeitas |
| `relatorio-seguranca.md` | 1 alto, 1 médio, 7 baixos, 10 info + o que está bem |
| `relatorio-performance.md` | build, bundle por rota, waterfalls, duplicação, índices SQL |
| `relatorio-produto.md` | fricções, gaps de domínio, melhorias por tela, PWA, TOP 10 |
| `relatorio-uiux.md` | problemas por viewport, tabela tela × viewport, sugestões |

Saúde geral: `tsc` 0 erros, `eslint` 0 erros / 16 warnings, `npm run build` OK sem warnings, RLS completa nas 15 tabelas, sem XSS/CSRF/open redirect.

---

## Os 10 achados mais importantes

| # | Sev. | Achado | Onde |
|---|---|---|---|
| 1 | CRÍTICO | O cron de lembretes push **nunca roda**: o proxy de auth responde 307 → /login antes do handler. Confirmado com curl. | `src/proxy.ts`, `src/lib/supabase/middleware.ts` |
| 2 | ALTO | Fatura do cartão cai no **mês errado** quando o vencimento é antes do fechamento (ex.: fecha 25, vence 5). Afeta sobra, dashboard, cron e relatórios. | `src/lib/cartao-calc.ts:50-66` |
| 3 | ALTO | Conta fixa **paga vira "Sem categoria"** em Gastos por categoria e Categoria mês a mês. | `pagar/actions.ts`, 2 relatórios |
| 4 | ALTO | **Overflow horizontal no mobile** no dashboard (428/375), `/recorrentes` (507/375) e `/cartoes` (471/375). | `page.tsx:548`, `recorrentes/page.tsx:77`, `cartoes/page.tsx:85` |
| 5 | ALTO | **Tablet 768 é o pior layout**: sidebar de 256 px deixa 497 px e o hero corta valores ("R$ 16.34"); nomes de contas somem. | grids `md:` vs `lg:` |
| 6 | ALTO | Laranja primário no **tema claro tem contraste 3,03:1** (falha AA) em texto, erros e botões. | `globals.css` |
| 7 | ALTO | Bundle inicial de **~230 KB gz em toda rota** porque o layout monta o dialog do FAB e a busca global sempre. | `(app)/layout.tsx:44-50` |
| 8 | MÉDIO | Parcelas com **erro de centavos** por float (1,15 em 5x → 0,22×4 + 0,27). | `cartao-calc.ts:73-85` |
| 9 | MÉDIO | `parseBRLInput("1.500")` salva **R$ 1,50** sem aviso. | `format.ts:14-23` |
| 10 | MÉDIO | Conta vencida da quinzena 15 **some do dashboard** a partir do dia 16. | `page.tsx:437-455` |

---

## Plano sugerido em 3 fases

### Fase 1 — correções rápidas — CONCLUÍDA em 05/09/2026

Todos os itens abaixo estão aplicados. `tsc` 0 erros, `eslint` 0 erros (avisos de 16 → 12), `npm run build` OK, `npm audit --omit=dev` 0 vulnerabilidades.

- [x] `/api/cron` liberado no matcher do proxy (junto com `sw.js`, `sounds/` e `.mp3`) e `CRON_SECRET` fail-closed com `timingSafeEqual`. Verificado com curl: sem header 401 (antes 307 → /login), secret errado 401, secret válido chega ao handler.
- [x] `pagarContaRecorrente` copia `categoria_id`, `categoria` e `quem_gastou` da conta; os 2 relatórios usam `pago?.categoria_id ?? c.categoria_id`.
- [x] `valoresParcelas` em centavos inteiros e `parseBRLInput` tratando ponto de milhar. Testados: 1,15 em 5x → 0,23 × 5; "1.500" → 1500; `1e3`, `0x10`, `-5` e `1.2345` rejeitados.
- [x] Checklist e alerta de atraso olhando as duas quinzenas; `nenhumDado` passou a considerar despesas.
- [x] `categorias` passado ao `AssinaturaFormDialog` nas 2 chamadas de `/cartoes/[id]`.
- [x] Erros `23505` (conta já paga no mês) e `23503` (banco com cartões) com mensagem amigável.
- [x] Os 4 toggles ativar/desativar checam `result?.error`.
- [x] Overflow mobile: `grid-cols-[minmax(0,1fr)]` no dashboard, `flex-wrap` na toolbar de `/cartoes`, `w-full max-w-96` nos 10 skeletons. Medido no DOM real: dashboard 398 → 343 px, toolbar 455 → 343 px.
- [x] `/recorrentes` passou de `md:grid-cols-2` para `lg:grid-cols-2` (resolve também o tablet de 768 px nessa tela).
- [x] `viewportFit: "cover"` e inputs/selects em `text-base md:text-sm`.
- [x] `unsubscribePush` filtra por `profile_id`; link de compra futura só aceita `http(s):`.
- [x] Headers de segurança em `next.config.ts` (`frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- [x] Busca global descarta respostas fora de ordem por contador de sequência.
- [x] 4 imports/variáveis sem uso removidos.

**Atenção — dois pontos que exigem ação sua:**

1. `CRON_SECRET` está **vazio** no `.env.local`. Com o fail-closed, o cron rejeita tudo até você gerar um segredo de 16+ caracteres e configurá-lo no `.env.local` e na Vercel.
2. O pacote `shadcn` **não podia ser removido**: `globals.css` importa `shadcn/tailwind.css`. Ele foi movido para `devDependencies` e **pinado em 4.16.2** — a versão 4.21.0 deixou de exportar `tailwind.css` e quebra o build. O `npm audit --omit=dev` agora dá zero.

### Fase 2 — estruturais — CONCLUÍDA em 05/09/2026

`tsc` 0 erros, `eslint` 0 erros / 12 avisos, `npm run build` OK, 25 rotas retornando 200 sem erro de runtime.

- [x] **Mês da fatura = mês do vencimento.** `mesPrimeiraParcela` e `parcelaNoMes` passaram a receber o cartão inteiro; 14 pontos de uso atualizados e `dia_vencimento` adicionado aos `select` dos 9 relatórios e da busca. Validado com os cartões reais do casal e com virada de ano.
- [x] **Lançamentos órfãos** de conta desativada ou excluída continuam somando, em `calcularSaldoMes` (helper `totalContasOrfas`) e por quinzena no dashboard.
- [x] **Lazy-load** do dialog do FAB e da busca global via `next/dynamic`; o dialog ganhou `defaultOpen`/`onClose` para montar sob demanda.
- [x] **Layout não bloqueante**: as 3 queries do FAB saíram do await e foram para `<Suspense>`. A shell agora pinta depois de 1 query em vez de 4.
- [x] **Tablet**: tabelas dos relatórios de `md:` para `lg:`, `/recorrentes` de `md:grid-cols-2` para `lg:grid-cols-2`.
- [x] **Alvos de toque de 44 px** no mobile em todas as variantes de botão e nos itens de select, sem mexer no desktop.
- [x] **Dialogs como bottom-sheet** no celular (ancorado embaixo, 92dvh, safe-area), resolvendo o rodapé escondido sem voltar ao sticky que sobrepunha campos.
- [x] **Contraste AA** no tema claro com um token novo `--organic-accent-contrast`.
- [x] **Skeleton genérico** no boundary do layout; cada rota usa o seu.
- [x] **Migration `0013_performance_e_integridade.sql`** com índices, policies RLS reescritas e trigger `assert_mesmo_casal()`. **Ainda não aplicada no banco.**
- [x] FAB movido para a direita, para não cobrir os botões centralizados dos estados vazios.
- [x] Popup de select limitado a 20rem de altura.
- [x] Link da busca para compra em andamento aponta para o mês da parcela atual (helper novo `mesDaParcela`).

**Não feito nesta fase:** `withSession()` + defaults `casal_id`/`criado_por` no banco. As actions seguem com 5 idas ao Supabase. Fica para a Fase 3, junto da abstração dos dialogs, porque as duas mexem nos mesmos 13 arquivos de actions.

**Precisa de você:** rodar a migration `0013` no SQL Editor do Supabase. Ela é idempotente e não altera dado existente.

#### Números medidos

| Rota | Antes (gz) | Depois (gz) |
|---|---|---|
| Relatórios sem dialog (fluxo mensal, categoria por mês, comprometimento, renda x despesa) | 229 KB | 167 KB |
| Relatórios com dialog de edição | 232 KB | 220 KB |
| Dashboard | 231 KB | 233 KB |
| Rotas de lista (despesas, cartões, rendas) | 248 KB | 248 KB |

O piso caiu 27% nas rotas que não embutem dialog. As rotas de lista não mudaram porque montam um dialog por linha — é o item de maior ganho restante e está na Fase 3.

#### Cores do tema claro

O `--primary` do tema claro saiu de `#c67139` para `#944d1e`. A recomendação original do relatório (`#b2622d`) foi medida e dá 3,77:1, não os 4,6:1 previstos, então não servia. O tom novo passa AA nas duas superfícies claras: 5,28:1 sobre o fundo e 4,70:1 sobre os cards. O laranja original continua no círculo do hero, no `theme-color` e no anel de foco. É uma mudança visível na identidade; se preferir o laranja mais claro de volta, o token está isolado em uma linha.

### Fase 3 — refatoração — CONCLUÍDA em 06/09/2026

`tsc` 0 erros, `eslint` 0 erros / 18 avisos, `npm run build` OK, as 22 rotas
respondendo 200 com sessão real, e os 4 relatórios migrados conferidos
valor a valor contra o comportamento anterior.

**Precisa de você antes de publicar:** rodar a migration `0014` no SQL Editor.
Ela é pré-requisito, não opcional — veja "Ordem de deploy" abaixo.

#### O que foi feito

- **`clienteAutenticado()` + defaults no banco.** As 13 actions repetiam
  `getUser()` → `profiles.select("casal_id")` → dois `if`. Agora `casal_id` e
  `criado_por`/`criada_por` têm default no Postgres (migration `0014`) e a
  autenticação usa `getClaims()`, que valida o JWT local. São duas idas ao
  servidor a menos por cadastro. A RLS continua sendo quem valida o escopo.
- **`parseForm` declarativo** (`lib/parse-form.ts`). Os 15 `parseFormData`
  viraram objetos de esquema com tipo inferido. Sem zod de propósito: são sete
  formatos fechados e a lib traria mais superfície do que economiza.
- **`useFormDialog` + `FormDialogShell` + `CampoForm`.** O esqueleto de
  Dialog/trigger/cabeçalho/form/erro/rodapé saiu dos 15 dialogs; sobrou só o
  que difere entre eles, que são os campos.
- **`EntityActionsMenu`.** Os 12 menus "⋮" viraram uma lista declarativa.
  Corrige duas inconsistências de origem: o item "Excluir" aparecia ora em
  `text-primary` ora em `text-red-600` (agora `text-destructive`, medido em
  5,09:1 no claro e 5,15:1 no escuro), e alguns itens não checavam
  `result?.error`, engolindo a falha em silêncio.
- **Um dialog por lista, carregado sob demanda** (`lib/dialog-de-lista.tsx`).
  Antes cada linha montava um formulário inteiro. `/relatorios/compras-do-mes`
  em agosto montava **246 dialogs** para, no máximo, um ser aberto; agora monta
  zero até alguém clicar. O mesmo vale para os botões de ação (Pagar, Pagar
  fatura, Comprei, Novo pagamento), que ganharam `useDialogSobDemanda`.
- **`dadosDoMes()`** (`lib/gastos-do-mes.ts`): as cinco consultas que
  `compras-do-mes`, `gastos-por-categoria`, `gastos-por-pessoa` e
  `maiores-gastos` faziam idênticas viraram uma função só, com os `select`
  em constantes. Isso fecha a classe de bug que apareceu na Fase 2, quando um
  relatório esqueceu `dia_vencimento` e passou a calcular a fatura diferente
  dos outros.
- **`campos-lancamento.tsx`**: valor + data + quinzena, com a inferência da
  quinzena pela data, era o mesmo bloco em despesa e renda extra.
- **`resolverClassificacao`**: categoria e "quem gastou" eram dois `await` em
  fila em sete actions; agora saem juntos.
- **Correção de brinde:** o preview de parcelas do dialog de compra
  recalculava a virada de ano na mão em vez de usar `mesDaParcela`, o helper
  que o servidor usa. Podia divergir da lista; agora é o mesmo código.

#### Números medidos

| Rota | Fase 2 | Fase 3 |
|---|---|---|
| Dashboard `/` | 233,6 KB gz | **193,6 KB gz** (−17%) |
| Listas (despesas, cartões, rendas, contas…) | 247–251 KB gz | **222–224 KB gz** (−10%) |
| `/relatorios/compras-do-mes` | 258,5 KB gz | **241,1 KB gz** (−7%) |
| Relatórios sem dialog | 167 KB gz | 167 KB gz (inalterado) |

Linhas nas quatro famílias que a Fase 3 mexeu: **10.255 → 7.860**. Descontando
os módulos compartilhados novos e os 13 arquivos `*-dialogs.tsx` que o padrão
de provider exige, o `src/` inteiro saiu de 22.842 para 22.192 linhas.

A estimativa da Fase 2 era de −1.500 a −2.000 linhas e o resultado foi −650.
A diferença é que aquela conta olhava só a duplicação removida e não previa os
arquivos de provider por entidade, que são o preço do ganho de bundle.

#### Ordem de deploy — importa

O código **não funciona sem a migration `0014`**. Os inserts deixaram de mandar
`casal_id`, então sem o default da coluna a RLS recusa toda criação. Testado:
sem a migration, cadastrar um banco falha com "new row violates row-level
security policy". Rode a `0014` antes de publicar. Se acontecer mesmo assim,
a mensagem na tela agora diz o que é, em vez de repetir o texto do Postgres.

#### Não feito, com o motivo

- **Tipos gerados do Supabase.** Precisa de `supabase gen types` autenticado
  no projeto, o que exige o access token ou a senha do banco — nenhum dos dois
  está no `.env.local`. Os tipos de linha mais repetidos já foram centralizados
  em `gastos-do-mes.ts`.
- **Suspense streaming no dashboard.** Medido em dev: `/` responde em 273 ms e
  as consultas já saem em paralelo. Quebrar uma página de 737 linhas em
  boundaries rende pouco perto do risco, e a Fase 2 já tirou as consultas do
  FAB do caminho crítico. Fica para quando o dashboard crescer.
- **TOP 10 de produto.** São dez funcionalidades novas, cada uma com decisão de
  produto embutida. Estão listadas abaixo, à espera da sua escolha.

#### TOP 10 de produto (valor × esforço) — aguardando sua escolha

1. Autocomplete com memória no lançamento + `quem_gastou` = usuário logado + valor primeiro.
2. Pagar em 1 toque com "Desfazer" no toast (vale para excluir também).
3. Dashboard mobile reordenado: faixa "hoje" → sobra da quinzena → checklist acima da dobra.
4. Push acionável "Marcar como paga" + lembretes D0/atraso/fatura fechou + `tag` anti-duplicata.
5. Contas com periodicidade anual/semestral (IPTU, IPVA, seguro).
6. Dívida parcelada vira conta recorrente (`contas_recorrentes.divida_id`).
7. Orçamento por categoria com barra no relatório e no dialog de despesa.
8. "Acerto do mês": renda por pessoa + rateio de gastos "casal".
9. `shortcuts` no manifest + `share_target` para comprovante Pix/notificação do banco.
10. Cartão: limite/% usado, "fecha em X dias", próximas 3 faturas, "Comprei" podendo ir no cartão.

---

## O que está bem feito (para não mexer)

- RLS uniforme em todas as tabelas, `security definer` com `search_path` travado, service role só no cron e filtrado por casal.
- `casal_id` e `criado_por` nunca vêm do formulário; `categoria_id` e `quem_gastou` revalidados sob RLS.
- `Promise.all` nas pages, `React.cache()` nos helpers, `getClaims()` sem round-trip, nenhum `select("*")`, `loading.tsx` em toda rota, ícones importados por nome.
- Drawer mobile fecha ao navegar, trava scroll e fecha por Esc/backdrop; sem sintomas de hydration mismatch.
- Service worker sem cache de assets: zero risco de servir JS velho após deploy.
