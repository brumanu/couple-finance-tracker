# Financeiro do Casal — Relatório de Produto e Ideias

Base analisada: `README.md`, `supabase/migrations/0001..0012`, `src/lib/{mes,sobra,cartao-calc}.ts`, todas as rotas em `src/app/(app)/**` (pages, dialogs, actions), `src/components/**`, `src/app/manifest.ts`, `public/sw.js`, `src/app/api/cron/push-reminders/route.ts`, `vercel.json` e o `git log` (94 commits, 10→17/ago/2026).

**Direção recente do produto (git log):** o foco dos últimos commits foi (1) fechar o ciclo "o que falta pagar" no dashboard — marcar fatura paga (`0011_pagamentos_fatura`), seção "Faturas dos cartões"; (2) atribuição `quem_gastou` em todas as entidades e relatório por pessoa; (3) explosão de relatórios (6 novos de uma vez); (4) "Quero comprar" com "cabe na sobra?". Ou seja: o app já cobre bem *registro* e *leitura*; o que falta agora é **velocidade de lançamento**, **inteligência de casal** (divisão, orçamento) e **PWA de verdade**.

---

## 1. Fricções de fluxo (lidas no código)

### 1.1 Lançar despesa — a tarefa mais frequente tem 7 campos e zero memória
`src/app/(app)/despesas/despesa-form-dialog.tsx`

- O formulário pede **descrição, valor, data, cartão, quinzena, categoria, quem gastou**. Só descrição/valor/data são obrigatórios, mas os selects de categoria e quem gastou aparecem sempre, e o usuário precisa preencher os dois toda vez para o relatório por pessoa/categoria ter sentido.
- **Nenhum aproveitamento do histórico.** "Mercado Extra" foi lançado 30 vezes com categoria "Mercado" e quem_gastou "casal", e na 31ª o app pede tudo de novo. A tabela `lancamentos` tem tudo para inferir (descricao + categoria_id + quem_gastou + criado_por).
- `quem_gastou` começa em `NENHUM_QUEM`. O padrão óbvio é **o usuário logado** (`session.userId` já está disponível no layout e na página) — o `MobileFab` recebe `membros` mas não recebe quem é o usuário atual.
- Ordem dos campos: descrição primeiro. Em apps de finanças o padrão é **valor primeiro** (teclado numérico já aberto, `inputMode="decimal"` já existe).
- O dialog muda de "despesa" para "compra no cartão" se você escolhe cartão — bom —, mas na **edição** isso é bloqueado com a mensagem "exclua e cadastre de novo" (`updateDespesa` em `despesas/actions.ts`). O usuário que errou o cartão precisa excluir (com confirmação), reabrir o FAB e redigitar tudo.

### 1.2 Pagar conta — 3 campos e um dialog para uma ação que quase sempre é "sim, o valor previsto, hoje"
`src/app/(app)/pagar/pagar-dialog.tsx`, `pagar-fatura-dialog.tsx`, `pagar/actions.ts`

- Clicar "Pagar" abre dialog com **descrição (editável!), valor e data**. Descrição da conta paga raramente muda; ela só existe porque `lancamentos.descricao` é `not null`. Para 90% dos casos a ação ideal é **um toque = pago (valor previsto, hoje)** com um "ajustar valor" secundário.
- **Informação que falta no dialog:** para contas variáveis (luz, água, gás) o usuário quer ver "mês passado você pagou R$ 132,40" e a média. A query é trivial (`lancamentos` where `conta_recorrente_id = X order by data_referencia desc limit 3`).
- **Desmarcar** (`desmarcar-button.tsx`) exige `ConfirmDialog`. Um "Desfazer" no toast do "Pagamento confirmado" resolveria 100% dos cliques errados sem confirmação para desfazer.
- Não existe **"pagar todas da quinzena"** — quem paga tudo no dia 15 faz N dialogs.

### 1.3 Registrar compra no cartão — dois caminhos, o mais visível é o mais longo
- Da lista `/cartoes` (`cartoes/page.tsx`): card do cartão → "Detalhes" → "Nova compra" (**3 toques + 1 navegação**). O card não tem botão "+ compra".
- Do FAB: escolher cartão dentro do dialog de despesa (bom), mas o campo "Cartão" fica **abaixo** de valor/data e é fácil esquecer; e o dialog não tem "compra em andamento" (só o `CompraFormDialog` tem).
- No `CompraFormDialog` a checkbox "Compra em andamento" força `data_compra` retroativa — funciona, mas a lógica é invisível para o usuário ("por que a data mudou sozinha?").

### 1.4 Ações destrutivas sem desfazer
Todos os `*-actions-menu.tsx` (despesa, compra, assinatura, recorrente, renda, renda extra, dívida, pagamento de dívida, categoria, cartão, banco, compra futura) fazem `delete` físico atrás de um `ConfirmDialog`. Não há `deleted_at`, não há undo, não há lixeira. Excluir uma compra parcelada de 24x por engano apaga 24 parcelas de projeção.

Exceção positiva: `reabrirCompraFutura` (compras futuras) tem "desfazer o comprei" — é o único fluxo com reversão.

### 1.5 Informação que o usuário precisa e não está na tela
| Onde | O que falta | Por quê importa |
|---|---|---|
| Dashboard `ContasQuinzenaCard` | Só mostra a quinzena atual. Contas da **quinzena 15 não pagas** somem quando vira dia 16 (`quinzenaAtualDados.contas`); o banner `contasEmAtraso` também só olha a quinzena atual (`page.tsx` L449-455) | A conta de dia 10 que ficou pra trás fica invisível justamente quando mais importa |
| Dashboard hero "Sobra em Agosto" | É **projeção** (soma contas previstas mesmo não pagas). Não existe "quanto já gastei até hoje" nem "ritmo" (gasto/dia × dias restantes) | O casal quer saber "posso gastar R$ 300 hoje?" |
| `/cartoes` (lista) | Não carrega `pagamentos_fatura` → não mostra se a fatura do mês está paga; não mostra "fecha em X dias" nem "próxima fatura" | O usuário abre Cartões para decidir "compro hoje ou depois do fechamento?" |
| `/cartoes/[id]` | Não mostra limite, % usado, nem as próximas 3 faturas (a função `parcelaNoMes` já calcula qualquer mês) | Previsão de fatura é o dado mais pedido em cartão |
| `/despesas` | Sem filtro por categoria / quem gastou / busca no mês; categoria mostrada como texto puro (`d.categoria`) sem cor/emoji, enquanto `/compras-futuras` usa chip colorido | Inconsistência visual e sem drill-down |
| `/dividas` | "Registrar pagamento" exige navegar ao detalhe; sem data de vencimento/parcela; sem "quitação prevista em N meses" | Dívida negociada em 12x não cabe no modelo |
| Busca global | Resultado leva para `/despesas?mes=...` sem destacar/scrollar até o item | Acha mas não mostra |
| `PagarDialog` | Não mostra valor pago no mês anterior | Ver 1.2 |
| `/recorrentes` | Sem histórico de valores pagos por conta (luz nos últimos 12 meses) | Contas variáveis |

### 1.6 Estados vazios pobres
- `ContasQuinzenaCard`: "Nada cadastrado para o dia 15." — sem CTA para `/recorrentes`.
- `FaturasCartaoCard`: "Nenhuma fatura em Agosto." — sem CTA.
- Relatórios (`fluxo-mensal`, `categoria-por-mes`, etc.): "Nenhum gasto registrado" — sem CTA.
- `/categorias` vazio: "Nenhuma categoria cadastrada" — deveria oferecer **"Criar categorias padrão"** (Mercado, Casa, Transporte, Lazer, Saúde, Educação, Pets, Assinaturas…) com emoji e cor. Hoje o casal precisa criar uma por uma antes de conseguir categorizar qualquer coisa.
- Primeiro acesso: o dashboard manda para Rendas/Contas, mas não há onboarding em passos (rendas → contas → cartões → categorias).

### 1.7 Ausência de feedback
- Sem **optimistic UI**: marcar pago espera o round-trip do server action + `revalidatePath("/")` (o dashboard inteiro re-renderiza com 14 queries). Em 4G isso é 1-2s de "nada acontece" depois de "Confirmar pagamento".
- Som de moeda só no cadastro; **pagar conta** — o momento de maior satisfação — não toca nada.
- Sem vibração (`navigator.vibrate`) no mobile.
- Toggle "Ativar/Desativar" em `recorrente-actions-menu.tsx` mostra toast de sucesso **sem checar erro** da action.

### 1.8 Fluxo "Comprei" quebra no cartão
`compras-futuras/comprei-dialog.tsx`: "Se foi no cartão, deixe desmarcado e cadastre a compra pelo cartão." — o pulo do gato da tela (desejo vira gasto sem redigitar) não funciona justamente para compras grandes, que são as que vão no cartão parcelado. A action `createDespesa` já sabe criar `compras_cartao`; basta reaproveitar.

---

## 2. Gaps do domínio

Formato: **problema → modelo de dados → tela/interação → esforço (P/M/G) → valor**.

### 2.1 Contas com periodicidade não mensal (IPTU, IPVA, seguro, matrícula, DPVAT) — **M / alto**
- **Problema:** `contas_recorrentes` assume mensal. IPTU (jan–mar), IPVA, seguro anual, material escolar não têm lugar; hoje viram despesa avulsa surpresa que destrói a sobra do mês.
- **Dados:** `contas_recorrentes.periodicidade text default 'mensal' check in ('mensal','bimestral','trimestral','semestral','anual')` + `mes_referencia smallint` (1-12, mês da 1ª ocorrência). Regra de vigência: `vigente(mes) = ativa && periodo && ((mes.mes - mes_referencia) mod N == 0)`.
- **Atenção:** a regra "conta vigente no mês" está **replicada em ~8 lugares** (`sobra.ts`, `page.tsx` do dashboard, `fluxo-mensal`, `renda-x-despesa`, `comprometimento-futuro`, `categoria-por-mes`, `gastos-por-pessoa`, `maiores-gastos`, `compras-do-mes`, cron). Antes de adicionar periodicidade, extrair `contaVigenteNoMes(conta, mes)` para `src/lib/contas-calc.ts` (mesma filosofia de `cartao-calc.ts`).
- **Tela:** no `RecorrenteFormDialog`, select "Repete: todo mês / a cada N meses / uma vez por ano em [mês]". No dashboard, badge "anual" na linha. Na projeção de 6 meses, o mês do IPVA já aparece com a barra menor.

### 2.2 Orçamento (meta) por categoria — **M / alto**
- **Problema:** existe `categorias` com cor/emoji e o relatório por categoria mostra %, mas não há teto. "Já gastamos quanto de mercado este mês?" só responde olhando relatório.
- **Dados:** `orcamentos (id, casal_id, categoria_id fk, valor_mensal numeric, created_at, unique(casal_id, categoria_id))`.
- **Tela:** (a) em `/categorias`, campo "Teto mensal" no `CategoriaFormDialog`; (b) em `/relatorios/gastos-por-categoria`, barra "R$ 820 de R$ 1.200" por categoria, vermelha ao passar; (c) **no `DespesaFormDialog`**, ao escolher categoria, linha "Mercado: faltam R$ 380 do teto"; (d) card compacto "Orçamentos" no dashboard com as 3 categorias mais perto do teto. Alerta push opcional a 80%/100%.

### 2.3 Divisão justa do casal ("quem deve a quem") — **M / alto**
- **Problema:** `quem_gastou` existe em tudo, o relatório por pessoa soma, mas **renda não tem dono** (`rendas` não tem `profile_id`) e não há noção de "pago por". Não dá para responder "cada um contribui proporcional à renda?" ou "Bruno pagou o mercado do casal, Jacqueline deve quanto?".
- **Dados:** `rendas.profile_id uuid null references profiles` (null = do casal); opcional `lancamentos.pago_por` / `compras_cartao.pago_por` (default = criado_por). `casais.modo_divisao text default 'proporcional' check in ('proporcional','meio_a_meio')`.
- **Tela:** novo relatório **"Acerto do mês"**: renda de cada um → cota justa (%) → gastos com `quem_gastou='casal'` rateados pela cota → gastos individuais 100% do dono → quem pagou o quê (`pago_por`) → "Jacqueline transfere R$ 312,50 para Bruno". Badge no dashboard "Acerto: R$ 312,50 → Bruno".
- Reaproveita `gastos-por-pessoa/page.tsx` quase inteiro.

### 2.4 Dívida negociada em parcelas — **P/M / alto**
- **Problema:** `dividas` é "valor total + pagamentos livres", comentário do schema diz "não entra no saldo". Dívida negociada (12x de R$ 250 todo dia 10) precisa aparecer na checklist da quinzena **e** baixar a dívida. Hoje o usuário lança duas vezes (despesa avulsa + pagamento da dívida) ou esquece uma.
- **Dados (barato, reaproveita tudo):** `contas_recorrentes.divida_id uuid null references dividas`. Ao criar dívida com "parcelada?", cria conta recorrente com `valor_previsto`, `dia_vencimento`, `quinzena`, `fim_vigencia` = última parcela. Em `pagarContaRecorrente`, se a conta tem `divida_id`, insere também `pagamentos_divida`.
- **Tela:** `DividaFormDialog` ganha "Negociada em N parcelas de R$ X, vence dia D". Card em `/dividas` mostra "parcela 4/12 · próxima dia 10" e "quita em Ago/27". Linha no `ContasQuinzenaCard` com badge "dívida".

### 2.5 Conferência de saldo real (reconciliação leve) — **M / alto**
- **Problema:** o app é 100% manual; o número que importa (saldo na conta) nunca é comparado com a projeção. Lançamento esquecido só é descoberto no fim do mês.
- **Dados:** `conferencias_saldo (id, casal_id, data date, saldo_informado numeric, criado_por)`.
- **Tela:** no dia 15 e 30 (ou quando quiser) o app pergunta "Quanto tem na conta agora?". Compara com `renda recebida − pagos até hoje − despesas até hoje` e mostra "R$ 184,30 não estão registrados — lançar como 'diversos'?" com botão que cria a despesa avulsa. É o jeito mais barato de manter o app honesto sem integração bancária.

### 2.6 Renda recebida (valor real) e renda variável — **M / médio**
- **Problema:** rendas são só `valor_previsto`; não há "recebi R$ 4.870 dia 15" como existe para contas (`lancamentos.tipo='conta_fixa'`). Hora extra/comissão hoje é renda extra desconectada.
- **Dados:** novo `tipo='renda_recebida'` no check de `lancamentos` + `lancamentos.renda_id uuid null references rendas`. Mesma mecânica de `pagosMes` em `calcularSaldoMes`: se há recebimento no mês, usa o real.
- **Tela:** no dashboard, na linha da renda da quinzena, botão "Recebi" (espelho do "Pagar"). Push no dia 15/30: "Caiu o adiantamento? Confirme o valor."

### 2.7 Cartão: limite, % usado, fechamento e previsão — **P/M / médio-alto**
- **Dados:** `cartoes.limite numeric null`.
- **Cálculo (já existe):** usado = fatura aberta + `restanteAposEste` de todas as compras (função `parcelaNoMes` retorna isso).
- **Tela:** barra de limite no card de `/cartoes` e no header de `/cartoes/[id]`; badge "fecha em 3 dias" / "fechada · compras agora caem em Out"; seção "Próximas faturas" com 3 barrinhas (Set R$ 1.240 · Out R$ 980 · Nov R$ 610) no detalhe. O `mesPrimeiraParcela` já sabe em qual fatura uma compra de hoje cairia — mostrar isso no `DespesaFormDialog` ao escolher cartão ("cai na fatura de Outubro, vence dia 10").

### 2.8 Assinatura anual / não mensal — **P / médio**
- **Problema:** `assinaturas_cartao.valor_mensal` — Amazon Prime anual, iCloud anual, domínio, antivírus não cabem.
- **Dados:** `assinaturas_cartao.periodicidade` + `mes_cobranca`, mesma abordagem de 2.1; `assinaturaAtivaNoMes` em `cartao-calc.ts` é o único lugar a mudar (bem encapsulado).
- **Tela:** no relatório de assinaturas, coluna "custo mensal equivalente" e total anual.

### 2.9 Feed de atividade do casal — **P / alto** (barato e muito "casal")
- **Problema:** dois usuários, zero visibilidade do que o outro fez. `criado_por` + `created_at` já existem em todas as tabelas.
- **Dados:** nenhum novo (opcional `updated_at`/`updated_by` via trigger para "editado").
- **Tela:** card "Novidades" no dashboard: "Jacqueline lançou Farmácia R$ 86 · ontem", "Bruno pagou Internet · hoje". Union das tabelas por `created_at desc limit 8` filtrando `criado_por != me`. Badge no ícone do app com o número (ver seção 4).

### 2.10 Meta de economia / reserva — **M / médio**
- **Dados:** `metas (id, casal_id, nome, valor_alvo, prazo date null, emoji, cor)` + `aportes_meta (id, meta_id, valor, data, criado_por)`. Aporte opcionalmente cria `lancamentos` tipo `aporte` (novo tipo) para sair da sobra.
- **Tela:** integrar com "Quero comprar": item da lista pode virar meta ("guardar R$ 300/mês → sofá em Fev/27"). A sobra média já calculada em `compras-futuras/page.tsx` sugere o aporte.

### 2.11 Recorrência de despesa avulsa / "lançar de novo" — **P / alto**
- **Problema:** feira toda sexta, gasolina toda semana. Cada uma exige o dialog inteiro.
- **Sem dados novos:** ação "Lançar de novo" no menu de cada despesa (e em "Últimas despesas" do dashboard) que abre o `DespesaFormDialog` pré-preenchido com tudo menos a data. Combina com 2.15 (autocomplete).
- Versão M: `contas_recorrentes.periodicidade='semanal'` + `dia_semana`.

### 2.12 Importar fatura do cartão (CSV) — **G / médio**
- **Problema:** cartão é onde mais se esquece de lançar. Nubank, Inter, C6 exportam CSV/OFX da fatura.
- **Dados:** `compras_cartao.hash_importacao text unique null` para dedupe.
- **Tela:** em `/cartoes/[id]`, "Importar fatura" → upload → preview em tabela (data, descrição, valor, parcela X/Y detectada por regex `(\d+)/(\d+)`) → marcar categoria em lote → confirmar. Só vale se o casal de fato usa muito o cartão; a cultura do app é lançamento manual, por isso valor médio.

### 2.13 Anexo de comprovante — **M / baixo-médio**
- **Dados:** bucket Supabase Storage `comprovantes` + `anexos (id, casal_id, entidade text, entidade_id uuid, path, created_at)`.
- **Tela:** ícone de clipe no `PagarDialog`, `PagamentoFormDialog` (dívida) e `DespesaFormDialog`. Combina com share target (seção 4): compartilhar o PDF do Pix direto do app do banco.

### 2.14 Histórico de alterações — **P (mínimo) / baixo-médio**
- Mínimo viável: `updated_at`/`updated_by` em todas as tabelas via trigger genérico; UI mostra "editado por Jacqueline em 14/08" no dialog de edição. Versão completa (tabela `audit_log` via trigger) só se surgirem conflitos entre os dois.

### 2.15 Autocomplete de descrição com memória — **P/M / alto**
- **Sem dados novos.** Server action `sugerirDescricoes(termo)` → `select distinct on (descricao) descricao, categoria_id, quem_gastou, cartao_id from lancamentos/compras_cartao where descricao ilike 'termo%' order by created_at desc limit 6` (reaproveita a estrutura de `components/search/actions.ts`).
- **Tela:** no `DespesaFormDialog`, ao digitar 2 letras aparecem chips "Mercado Extra · Mercado · casal"; tocar preenche descrição, categoria, quem gastou e cartão. Lançamento cai para **valor + tocar sugestão + salvar**.

### 2.16 Alertas de gasto anormal — **M / médio**
- Cron já roda diariamente. Adicionar: categoria do mês > 130% da média dos 3 meses anteriores (dados de `categoria-por-mes` já calculam isso) → push "Mercado já está em R$ 1.480, 40% acima do normal". Precisa de tabela `alertas_enviados (casal_id, chave, mes)` para não repetir.

### 2.17 Exportação — **P / médio**
- Botão "Exportar CSV" em `/relatorios/compras-do-mes` (as linhas já estão montadas em `LinhaCompra[]`). Route handler que devolve `text/csv` — o sandbox de PWA permite download normal.

### 2.18 Transferência entre quinzenas / carry-over — **P / médio**
- **Problema:** `QuinzenaSaldoCard` mostra Q15 e Q30 independentes; sobra do dia 15 não "vira" saldo inicial do dia 30, nem sobra de Julho vira saldo de Agosto. O usuário mentalmente faz isso.
- **Tela (sem dados):** no card da quinzena 30, linha "+ R$ 420 que sobraram da quinzena 15" (saldo acumulado); no hero, toggle "acumulado desde [mês]". Versão com dados: `ajustes_saldo (casal_id, mes_referencia, valor, motivo)` para "saldo inicial" manual.

### 2.19 Categorias padrão e sub-uso — **P / médio**
- Seed de categorias na primeira visita (ver 1.6). Também: categoria em `pagarContaRecorrente` — o lançamento de pagamento **não grava** `categoria_id` (comentário em `maiores-gastos/page.tsx` L1558), então relatórios caem no fallback da conta; copiar `categoria_id`/`categoria`/`quem_gastou` da conta no insert é uma linha.

---

## 3. Melhorias nas telas existentes

### 3.1 Dashboard (`src/app/(app)/page.tsx`) — o que deve estar acima da dobra no celular
Ordem atual (mobile, 1 coluna): saudação → **hero Sobra do mês** → **gráfico de projeção (6 barras, 128px)** → 2 cards de quinzena → banner atraso → Contas da quinzena → Últimas despesas → Faturas → Renda extra → Dívidas.

A ação principal (pagar contas) está **a ~3 telas de scroll** do topo. Proposta:

1. **Faixa "Hoje"** (só se houver algo): "2 contas venceram · Fatura Nubank fecha amanhã · Adiantamento cai em 3 dias". Substitui o banner de atraso e o considera **as duas quinzenas** (ver 1.5).
2. **Hero da quinzena atual**, não do mês: "Sobra até dia 30: R$ 1.240" grande + "no mês: R$ 2.180" pequeno. O app é quinzenal; o hero mensal contradiz isso. Progresso "5 de 8 contas pagas" inline.
3. **Contas da quinzena** (checklist) com toggle "ver dia 15 / dia 30" e "pagar todas".
4. **Faturas** (já bom).
5. **Últimas despesas** com "Lançar de novo" por linha.
6. Recolhido / abaixo: projeção de 6 meses (virar `<details>` ou card menor), cards das duas quinzenas, renda extra, dívidas, novidades do parceiro (2.9).

Detalhes: o gráfico de projeção rotula barras com valores sem "R$" e sem centavos — ok —, mas não indica **qual mês tem IPVA/parcela terminando**; tooltip só via `title`. A saudação `saudacaoContexto` ("reta final da quinzena do salário") é ótima — usar esse mesmo tom no push.

### 3.2 Relatórios (`src/app/(app)/relatorios/**`)
Há 10 relatórios, vários sobrepostos:

| Relatório | Situação | Proposta |
|---|---|---|
| Todas as compras do mês | Base de tudo, tem editar/excluir, ordenação por valor | Manter como **"Lançamentos"** (nome mais claro) |
| Maiores gastos | = "compras do mês" com `sort=valor_desc` e sem edição | **Remover**; virar atalho/aba "Top 10" dentro de Lançamentos |
| Gastos por categoria | Bom (barras + lista) | Adicionar donut SVG e o orçamento (2.2) |
| Categoria mês a mês | Bom, 6 meses fixos | Fundir com Fluxo mensal numa tela **"Evolução"** com abas (Total / Por categoria / Renda x Despesa) e seletor de janela (6/12 meses) |
| Fluxo mensal | 12 meses, só total | idem acima; virar linha SVG, não barras |
| Renda x despesa | 2 meses, rico em breakdown | idem; a versão "12 meses" é o que falta |
| Gastos por pessoa | Bom | Evoluir para "Acerto do mês" (2.3) |
| Comprometimento futuro | Sobrepõe a projeção do dashboard | Manter, mas com **drill-down** por mês (quais parcelas terminam quando) |
| Compras parceladas | Excelente (projeção de liberação) | Manter |
| Assinaturas | Bom | Adicionar custo anual e "não uso há X" (manual) |

**Relatórios que faltam e batem com o domínio:**
- **Quinzena a quinzena**: histórico de sobra Q15 vs Q30 nos últimos 12 meses — o app é quinzenal e não tem um único relatório por quinzena.
- **Por cartão**: evolução da fatura de cada cartão (só existe o valor do mês).
- **Dívidas — evolução**: total devido mês a mês, data prevista de quitação.
- **Gasto por dia da semana / calendário de calor** do mês (despesas avulsas têm `data_pagamento`) — mostra "sexta é o dia que mais gastamos".
- **Previsto x realizado** por conta fixa (previsto vs `lancamentos.valor`) — mostra onde a previsão está furada.

**Gráficos vs tabelas:** todos os gráficos são divs com `width %`. Para linhas (fluxo, evolução de dívida, saldo acumulado) usar SVG inline; para composição (categoria) donut SVG. Tabelas continuam certas para listas editáveis. Os relatórios de janela fixa (`fluxo-mensal`, `comprometimento-futuro`, `categoria-por-mes`) não têm `MonthSwitcher` — inconsistente com os demais.

### 3.3 Cartões (`/cartoes`, `/cartoes/[id]`)
- Card da lista: adicionar **status da fatura** (paga/aberta/vencida — carregar `pagamentos_fatura`), botão "+ compra" direto, "fecha em X dias", barra de limite (2.7).
- Detalhe: "Próximas 3 faturas", "Compras que terminam este mês" (liberação), botão "Pagar fatura" também aqui (hoje só no dashboard).
- `CompraFormDialog`: explicar visualmente "em andamento" ("vamos considerar da parcela 4 em diante; a data da compra foi ajustada para Mai/26").
- Assinaturas: "Encerrar hoje" é bom; falta "pausar por N meses" e periodicidade anual (2.8).

### 3.4 Dívidas
- Parcelas negociadas (2.4); "Pagar parcela" inline no card sem ir ao detalhe; "quita em N meses no ritmo atual" (média dos últimos 3 pagamentos); campo credor/tipo opcional; lembrete push quando `dia_vencimento` existir.
- Opção por dívida: "pagamento entra na sobra da quinzena" (cria `lancamentos` vinculado) — hoje é sempre fora do saldo, o que obriga dupla digitação.

### 3.5 Compras futuras ("Quero comprar")
- **"Comprei" no cartão** (1.8) — maior fricção da tela.
- Indicador por item "cabe este mês" (valor ≤ sobra do mês atual) além da média de 6 meses.
- "Guardar por mês" → vira meta (2.10).
- Itens comprados acumulam na tela — arquivar após 30 dias ou seção recolhida.
- Reordenar prioridade por arrastar (ou "subir/descer").
- `link` — mostrar domínio ("amazon.com.br") como hint.

### 3.6 Contas fixas / Rendas
- `/recorrentes`: histórico de valores pagos (12 meses) no dialog de edição; badge "variável" quando o desvio entre previsto e pago é > 15%.
- `/rendas`: "Recebi" (2.6); dono da renda (2.3).

---

## 4. PWA / mobile

Estado atual: `manifest.ts` mínimo (nome, ícones 512 `any` + apple 180, `display: standalone`, `orientation: portrait`); `public/sw.js` só trata `push` e `notificationclick`; **sem** `fetch` handler (zero offline — sem rede o app mostra o erro do navegador), sem `shortcuts`, sem `share_target`, sem `id`/`scope`/`screenshots`/`categories`, ícone sem `purpose: maskable` (fica com borda branca no Android), sem prompt de instalação, sem badge, notificação sem `tag` (duplica se o cron rodar 2x) e sem `actions`.

### 4.1 Instalação — **P / alto**
- Capturar `beforeinstallprompt` num client component; item "Instalar app" na sidebar/menu mobile quando disponível.
- iOS não dispara o evento e **web push só funciona com o app instalado na tela inicial**: mostrar banner "Toque em Compartilhar → Adicionar à Tela de Início" quando `navigator.standalone === false` e UA Safari. Hoje o botão de sino simplesmente some no iOS Safari (`supported=false`) sem explicar.
- Manifest: `id: "/"`, `scope: "/"`, ícone `purpose: "maskable"`, `screenshots` (form_factor narrow/wide → prompt de instalação rico no Chrome), `categories: ["finance"]`. `orientation: "portrait"` trava o app instalado no desktop — usar `"any"` ou omitir.

### 4.2 Shortcuts do manifest — **P / alto**
```ts
shortcuts: [
  { name: "Lançar despesa", url: "/despesas?nova=1", icons: [...] },
  { name: "Contas da quinzena", url: "/?secao=contas" },
  { name: "Cartões", url: "/cartoes" },
  { name: "Quero comprar", url: "/compras-futuras" },
]
```
`?nova=1` abre o `DespesaFormDialog` automaticamente (ler `searchParams` e passar `defaultOpen`). Long-press no ícone → 1 toque → dialog aberto.

### 4.3 Share target — **M / médio-alto** (muito brasileiro)
```ts
share_target: { action: "/compartilhar", method: "POST", enctype: "multipart/form-data",
  params: { title: "title", text: "text", url: "url", files: [{ name: "comprovante", accept: ["image/*","application/pdf"] }] } }
```
Route handler `/compartilhar` recebe o texto do comprovante Pix / notificação do banco ("Compra aprovada R$ 87,90 em MERCADO EXTRA"), extrai valor por regex `R\$\s?([\d.]+,\d{2})` e descrição, e redireciona para `/despesas?nova=1&valor=87,90&descricao=Mercado+Extra`. Com 2.13, o arquivo vira anexo. Isso transforma "lançar" em "compartilhar da notificação do banco".

### 4.4 Offline básico — **P/M / médio**
- `sw.js`: precache do shell (`/`, `/offline`, ícones, `coin.mp3`, fontes) na instalação; estratégia network-first com fallback para `/offline` (página estática "Sem conexão — o último dashboard que você viu"). Cache de navegação stale-while-revalidate para páginas GET.
- Versão G: fila de lançamentos offline com Background Sync (`lancamentos_pendentes` em IndexedDB → replay do server action). Só se o casal de fato lança sem sinal (supermercado subterrâneo é caso real).
- Atenção ao ciclo de update: adicionar `skipWaiting`/`clients.claim` e um toast "Nova versão — recarregar".

### 4.5 Badge de notificação — **P / médio**
- `navigator.setAppBadge(n)` com n = contas não pagas + faturas abertas da quinzena (chamar de um client component no dashboard) e no `sw.js` ao receber push (`self.registration` tem acesso a `navigator.setAppBadge` em SW). `clearAppBadge` ao abrir o dashboard. Também serve para 2.9 ("2 novidades da Jacqueline").

### 4.6 Push acionável — **M / alto**
- Payload do cron ganha `tag` (`conta-${id}-${mes}`) e `renotify: false` → sem duplicatas; `actions: [{ action: "pagar", title: "Marcar como paga" }, { action: "abrir", title: "Ver" }]`; `data: { tipo, id, mes, token }`.
- `sw.js` em `notificationclick`: se `event.action === "pagar"`, `fetch("/api/push/acao", { method: "POST", body: JSON.stringify(data) })`. Como o SW é same-origin, os cookies da sessão Supabase vão junto e o handler pode usar `createClient()` normal; alternativa mais robusta é um token HMAC (`CRON_SECRET`) com `conta_id + mes + exp` gerado pelo cron, validado pelo handler com service client. O handler reaproveita `pagarContaRecorrente`/`pagarFatura` (valor previsto, hoje).
- Novos lembretes no cron (`push-reminders/route.ts` já tem toda a estrutura): **D0** ("vence hoje"), **atraso** (D+1, D+3, uma vez cada — precisa de `lembretes_enviados`), **"fatura fechou hoje — R$ X"** (`dia_fechamento`), **dia 15/30** ("caiu o adiantamento? sobra prevista: R$ Y"), **resumo semanal** (domingo: gasto da semana vs anterior). Cron às `0 12 * * *` UTC = 09:00 BRT, bom; considerar segundo horário 19:00 BRT para D0.
- URL do push de conta é `/` — levar para `/?secao=contas` e scrollar.

### 4.7 Widget de sobra
Não existe API de widget para PWA no Android/iOS hoje. Substitutos honestos: badge com nº de contas (4.5), push de resumo diário/semanal (4.6) e shortcut "Contas da quinzena" (4.2). Não prometer widget.

---

## 5. TOP 10 priorizado (valor × esforço)

| # | Ideia | Esforço | Valor | Justificativa |
|---|---|---|---|---|
| 1 | **Autocomplete com memória + quem_gastou = eu por padrão + valor primeiro** (1.1, 2.15) | P/M | Alto | A tarefa mais frequente cai de 7 campos para "valor + tocar sugestão + salvar" |
| 2 | **Pagar em 1 toque + "Desfazer" no toast** (1.2, 1.4) | P | Alto | Remove um dialog e uma confirmação das duas ações diárias; vale para excluir também (soft undo) |
| 3 | **Dashboard mobile reordenado + atraso das duas quinzenas** (3.1, 1.5) | P/M | Alto | Coloca a checklist de pagamento acima da dobra e para de esconder conta atrasada do dia 15 |
| 4 | **Push acionável "Marcar como paga" + D0/atraso + tag** (4.6) | M | Alto | O lembrete vira ação; hoje o push só avisa em D-2/D-1 e some |
| 5 | **Contas com periodicidade anual/semestral** (2.1) | M | Alto | IPTU/IPVA/seguro são o furo clássico de orçamento brasileiro; de quebra centraliza a regra de vigência hoje copiada em 8 arquivos |
| 6 | **Dívida parcelada vira conta recorrente (`divida_id`)** (2.4) | P/M | Alto | Reaproveita 100% do fluxo de pagar conta; acaba com a dupla digitação |
| 7 | **Orçamento por categoria** (2.2) | M | Alto | Categorias já têm cor/emoji e relatório; falta o teto e a barra no dialog de despesa |
| 8 | **Acerto do mês / divisão justa** (2.3) | M | Alto | É o diferencial "casal": `quem_gastou` já existe, falta renda por pessoa e o cálculo |
| 9 | **Shortcuts do manifest + share target (Pix/notificação do banco)** (4.2, 4.3) | P + M | Médio-alto | Lançar vira "compartilhar"; shortcuts são 10 linhas |
| 10 | **Cartão: limite/% usado, "fecha em X dias", próximas 3 faturas, "Comprei" no cartão** (2.7, 1.8) | P/M | Médio-alto | Tudo calculável com `cartao-calc.ts` de hoje; só falta expor |

**Fila seguinte (bons, mas depois):** feed de atividade do casal (2.9, P), conferência de saldo real (2.5, M), categorias padrão + copiar categoria no pagamento (2.19, P), "Lançar de novo" (2.11, P), badge (4.5, P), install prompt + banner iOS (4.1, P), offline básico (4.4), consolidação dos relatórios (3.2), renda recebida (2.6), exportar CSV (2.17), importar fatura CSV (2.12, G), anexos (2.13), metas de economia (2.10), alertas de gasto anormal (2.16).
