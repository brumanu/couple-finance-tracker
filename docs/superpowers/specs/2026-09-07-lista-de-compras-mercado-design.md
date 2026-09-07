# Lista de compras de mercado — design

**Data:** 2026-09-07
**Status:** aprovado, pronto pro plano de implementação
**Migration alvo:** `0015_lista_mercado.sql`

---

## 1. O problema

Montar a lista de mercado é uma coisa; usá-la dentro do mercado é outra bem diferente.
O cadastro acontece sentado, no computador, com calma. O uso acontece em pé, com uma
mão só, carrinho na outra, sinal de celular ruim. Um item que você não achou hoje
precisa reaparecer na próxima ida sem você ter que lembrar dele.

A feature entrega três coisas:

1. Montar a lista rápido — item a item durante a semana, ou vários de uma vez colando um bloco.
2. Usar a lista no corredor — tocar pra marcar o que achou, arrastar pra marcar o que faltou.
3. Fechar a compra — informar o total, virar despesa, e levar o que sobrou pra próxima lista.

## 2. Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Relação com finanças | Total no fim vira despesa; preço por item é **opcional** | Digitar 30 preços no corredor não acontece na vida real, mas anotar o preço de um ou outro item é útil |
| Ciclo da lista | **Uma lista por ida**, fechada com data e total | Dá histórico por compra e dá um destino claro pro item não encontrado |
| Cadastro | Item a item com autocomplete **e** bloco de texto — os dois em mobile e desktop | Item a item é o modo do dia a dia; o bloco resolve "me mandaram a lista pronta" |
| Organização | **Lista corrida**, ordem de cadastro | Agrupar por setor exigiria taxonomia pra manter; o ganho não paga |
| Fechamento | Tela perguntando o que manter + **próxima lista já criada** | Fecha o ciclo sem passo manual entre uma compra e outra |
| Sincronização | Estado no cliente + fila em lote | Sinal de mercado é ruim; server action por toque trava a tela |
| Navegação mobile | Mercado entra no bottom-nav; **Rendas** vai pro menu lateral | É a feature mais mobile do app; enterrá-la no menu contraria o motivo dela existir |
| Testes | Vitest só pra lógica pura | Três funções que erram calado; o resto não paga o custo |

**Abordagens descartadas:**

- **Server action por toque** (o padrão do resto do app). Consistente e barato, mas cada
  marcação vira ida ao servidor. Dentro do mercado, com uma barra de sinal, marcar 30
  itens é sofrível. É o padrão certo pra tela de cadastro e errado pra tela de corredor.
- **Offline-first com service worker** (cache da rota, fila em IndexedDB, background sync).
  Funciona sem sinal nenhum, mas é bastante código e o `public/sw.js` hoje é push puro —
  mexer nele arrisca a notificação que já funciona. A fila da seção 6 deixa o caminho
  pronto: ela vira a fila do IndexedDB sem refazer a tela.
- **Reaproveitar `compras_futuras`** com uma flag de tipo. Barato e errado: aquela tabela
  não tem sessão de compra, não tem três estados por item, e a semântica ("desejo de longo
  prazo") conflita com "lista da semana".

---

## 3. Modelo de dados

Duas tabelas novas, seguindo as convenções já estabelecidas: default `current_casal_id()`
(migration 0014), policy `for all to authenticated` com `(select ...)` (0013), e trigger
`assert_mesmo_casal` nas FKs que atravessam casal (0013).

```sql
-- ---------------------------------------------------------------------
-- listas_mercado — uma ida ao mercado
-- ---------------------------------------------------------------------
create table if not exists public.listas_mercado (
  id               uuid primary key default gen_random_uuid(),
  casal_id         uuid not null default public.current_casal_id()
                     references public.casais(id) on delete cascade,
  status           text not null default 'aberta'
                     check (status in ('aberta', 'finalizada')),
  finalizada_em    date,
  total            numeric(12,2) check (total >= 0),
  lancamento_id    uuid references public.lancamentos(id)    on delete set null,
  compra_cartao_id uuid references public.compras_cartao(id) on delete set null,
  criado_por       uuid default auth.uid()
                     references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),

  -- Fechada tem data e total; aberta não tem nem um nem outro.
  constraint listas_mercado_fechamento_coerente check (
    (status = 'aberta'     and finalizada_em is null     and total is null) or
    (status = 'finalizada' and finalizada_em is not null and total is not null)
  ),
  -- A despesa gerada mora em uma das duas tabelas, nunca nas duas.
  constraint listas_mercado_uma_despesa check (
    lancamento_id is null or compra_cartao_id is null
  )
);

-- A regra que faz a tela mobile ficar simples: no máximo UMA lista aberta por
-- casal, então /mercado nunca precisa de seletor. Também impede que dois
-- celulares criem duas listas ao mesmo tempo.
create unique index if not exists listas_mercado_uma_aberta_idx
  on public.listas_mercado (casal_id)
  where status = 'aberta';

create index if not exists listas_mercado_historico_idx
  on public.listas_mercado (casal_id, finalizada_em desc)
  where status = 'finalizada';

-- ---------------------------------------------------------------------
-- itens_lista_mercado
-- ---------------------------------------------------------------------
create table if not exists public.itens_lista_mercado (
  id            uuid primary key default gen_random_uuid(),
  casal_id      uuid not null default public.current_casal_id()
                  references public.casais(id) on delete cascade,
  lista_id      uuid not null references public.listas_mercado(id) on delete cascade,
  nome          text not null check (length(trim(nome)) > 0),
  quantidade    text,
  preco         numeric(12,2) check (preco >= 0),
  status        text not null default 'pendente'
                  check (status in ('pendente', 'carrinho', 'nao_encontrado')),
  faltou_antes  boolean not null default false,
  ordem         int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists itens_lista_mercado_lista_idx
  on public.itens_lista_mercado (lista_id, ordem);

-- Autocomplete: agrega nomes por frequência dentro do casal.
create index if not exists itens_lista_mercado_nome_idx
  on public.itens_lista_mercado (casal_id, nome);
```

**RLS** — as duas tabelas no mesmo formato da 0013:

```sql
alter table public.listas_mercado      enable row level security;
alter table public.itens_lista_mercado enable row level security;

create policy "listas_mercado_scope" on public.listas_mercado
  for all to authenticated
  using      (casal_id = (select public.current_casal_id()))
  with check (casal_id = (select public.current_casal_id()));

create policy "itens_lista_mercado_scope" on public.itens_lista_mercado
  for all to authenticated
  using      (casal_id = (select public.current_casal_id()))
  with check (casal_id = (select public.current_casal_id()));
```

**Triggers de integridade** — a checagem de FK roda como dona da tabela e não passa por
RLS, então sem isso dá pra apontar pra registro de outro casal:

```sql
create trigger itens_lista_mercado_mesmo_casal
  before insert or update on public.itens_lista_mercado
  for each row execute function public.assert_mesmo_casal('listas_mercado', 'lista_id');

create trigger listas_mercado_mesmo_casal_lancamento
  before insert or update on public.listas_mercado
  for each row execute function public.assert_mesmo_casal('lancamentos', 'lancamento_id');

create trigger listas_mercado_mesmo_casal_compra
  before insert or update on public.listas_mercado
  for each row execute function public.assert_mesmo_casal('compras_cartao', 'compra_cartao_id');
```

### Notas sobre colunas

- **`quantidade` é texto livre** ("5kg", "2x", "1 pacote"). Separar número e unidade seria
  burocracia num campo que ninguém soma.
- **`faltou_antes`** marca o item que veio da lista anterior. Não é estritamente necessária,
  mas devolve visível o que a feature promete: o item não só sobrevive, ele avisa que
  sobreviveu.
- **Sem tabela de catálogo.** O autocomplete lê o próprio histórico de `itens_lista_mercado`,
  agrupado por nome e ordenado por frequência. Nasce sabendo o que o casal compra e nunca
  precisa de manutenção.

---

## 4. Rotas e telas

| Rota | O que é |
|---|---|
| `/mercado` | A lista aberta. **É a tela.** Resolve sozinha qual lista mostrar. Sem lista aberta, o estado vazio é um botão: *"Nova lista de mercado"* |
| `/mercado/historico` | Listas finalizadas: data, total, quantidade de itens |
| `/mercado/[id]` | Uma lista finalizada, só leitura: o que foi levado, o que faltou, total, link pra despesa gerada. Mesmo padrão de `cartoes/[id]` e `dividas/[id]` |

**`/mercado` no celular** — lista corrida ocupando a tela inteira, linhas altas, fonte
grande, contador no topo (*"12 de 30 no carrinho"*). Campo de adicionar item fixo no
rodapé, acima do teclado. Botão "Finalizar compra" no topo, fora do alcance do polegar,
de propósito.

**`/mercado` no desktop** — mesma lista, mais densa, com o bloco de cadastro (textarea de
vários itens) aberto ao lado.

**Navegação** — em `src/components/nav/nav-items.ts`: entra
`{ href: "/mercado", label: "Mercado", icon: ShoppingBasketIcon }` sem `desktopOnly`, e
`Rendas` ganha `desktopOnly: true`. O bottom-nav continua sendo um grid de 6 colunas;
Rendas permanece acessível pelo menu lateral, que abre no mobile também.

**FAB mobile** — o FAB de despesa (`src/components/nav/mobile-fab.tsx`) fica escondido em
`/mercado`: a rota já tem seu próprio campo de entrada fixo no rodapé, e dois botões
flutuantes disputando o mesmo canto é ruído.

---

## 5. A tela do corredor

### Os três estados

Um item é `pendente`, `carrinho` ou `nao_encontrado`.

- **Tocar** em qualquer lugar da linha → `carrinho`. Tocar de novo desfaz.
- **Arrastar pra esquerda** → `nao_encontrado`. Arrastar de novo devolve pra `pendente`.

A linha inteira é o alvo da ação comum — é a maior área de toque possível, que é o que se
quer com uma mão só. Editar quantidade e preço é ação rara e mora num botão próprio
(ver abaixo), nunca competindo com o toque principal.

### Por que o swipe comita direto

No corredor você está com uma mão só. "Arrastar revela botão, tocar no botão confirma"
são dois gestos pra uma decisão. Então o swipe completa sozinho ao passar de **35% da
largura**: a linha desliza, ganha fundo âmbar-escuro com ícone de "faltou", e volta pro
lugar já riscada.

O risco é o swipe acidental durante a rolagem. Duas defesas:

1. **Trava de intenção** — só começa a rastrear horizontalmente se `abs(dx) > abs(dy) * 1.5`
   nos primeiros ~10px de movimento.
2. **Desfazer** — toast do `sonner` (já é dependência) com ação de reverter.

Implementação: eventos de ponteiro + `transform` no CSS, num hook `useSwipeItem`.
**Sem biblioteca de gestos nova** — não vale o bundle por causa de uma linha de lista.

### A linha

- Nome em fonte grande; quantidade em cinza ao lado (*"Leite · 2x"*).
- Preço à direita **só se existir**. Sem preço, sem campo vazio — 30 linhas com placeholder
  de preço é poluição.
- No carrinho: riscado e esmaecido, **mas na mesma posição**. Nada pula de lugar embaixo do
  dedo (é o motivo de a ordem ser a de cadastro).
- Não encontrado: riscado com marcador de "faltou".
- `faltou_antes = true`: selinho discreto de "faltou da última vez".

### Preço e quantidade não moram na linha

No canto direito de cada linha há um botão discreto de reticências (`⋯`), com área de toque
própria e `stopPropagation` — ele abre uma folha de baixo com quantidade, preço e remover.
Como é um alvo separado do resto da linha, editar nunca disputa com marcar.

A tela do corredor continua sendo uma lista de nomes; quem quiser anotar preço anota sem
atrapalhar quem não quer.

### Adicionar item

Campo fixo no rodapé, acima do teclado. Digita → sugestões do histórico aparecem logo
acima do campo → `Enter` cadastra e o campo **continua focado** pro próximo. As sugestões
são carregadas de uma vez quando a tela abre (uma query agregada) e filtradas no cliente:
digitar não vai ao servidor.

### Bloco de cadastro

Textarea onde cada linha (ou item separado por vírgula) vira um item. Presente nas duas
plataformas — no desktop aberto ao lado da lista, no mobile recolhido atrás de um botão
*"colar lista"*.

---

## 6. Sincronização

O componente servidor carrega lista + itens uma vez e entrega pro cliente. A partir daí:

1. Todo toque altera o **estado local na hora** e empilha a mudança numa fila
   (`Map<idDoItem, camposAlterados>`), espelhada no `localStorage` sob a chave da lista.
2. Flush com **debounce de ~1,5s** manda pra `sincronizarItens(listaId, itens[], remocoes[])`:
   um `upsert` só pros itens tocados e um `delete` pros removidos.
3. **Sucesso:** limpa o que foi enviado. **Falha:** mantém na fila e tenta de novo no
   próximo toque, ao voltar o foco da janela, e a cada 20s.
4. Itens novos recebem `crypto.randomUUID()` no cliente. Adicionar vira só mais uma entrada
   da fila, e o `upsert` por id torna todo reenvio **idempotente** — nada duplica se a rede
   piscar.
5. **Ao carregar com fila pendente:** a fila local ganha nos itens que ela toca (é intenção
   ainda não enviada); o servidor ganha no resto.

**Indicador de estado** no topo, discreto: *salvo* / *salvando…* / *sem conexão — guardado
no aparelho*. Você precisa saber que o toque pegou, sem um spinner piscando a cada item.

**Limitação conhecida:** com os dois celulares na mesma lista, a última escrita vence por
item. Ninguém perde a lista, mas um pode desmarcar o que o outro marcou. Realtime
resolveria e custa caro; a mitigação incluída é revalidar os dados quando a aba volta ao
foco.

### Três ajustes feitos durante a implementação

**A fila sobe o item inteiro, não o delta por campo.** O desenho original mandaria os
campos alterados, o que obrigaria um `UPDATE` por item — trinta idas ao servidor num flush
de trinta itens, numa tela cuja razão de existir é não depender da rede. Mandando a linha
inteira, inserção e atualização viram um `upsert` só. O custo é que "a última escrita
vence" passa a valer por linha em vez de por campo, que é a mesma limitação já assumida
acima.

**`sincronizarItens` não revalida a rota.** Ela roda a cada flush; revalidar devolveria a
página inteira do servidor a cada punhado de toques. O cliente já tem o estado certo —
quem recarrega é a volta ao foco da aba, que é justamente a mitigação do parágrafo acima.

**A fila guardada é lida por `useSyncExternalStore`.** Restaurar o `localStorage` num
`useEffect` com `setState` é o anti-padrão que o `react-hooks/set-state-in-effect` acusa, e
este repositório não tem nenhum `eslint-disable` — sinal de que aqui não se silencia regra.
`useSyncExternalStore` é a API que o React oferece pra ler sistema externo, e resolve a
hidratação de brinde: no servidor o snapshot é vazio (mesmo HTML dos dois lados), e depois
de hidratar a tela recebe o que estava no aparelho.

---

## 7. O fechamento

### Antes de abrir

Tocar em "Finalizar compra" **força o flush pendente e espera**. Sem rede, a tela não abre:
*"3 alterações ainda não salvas. Tente de novo em um instante."* É o único ponto do fluxo
que bloqueia o usuário, e é deliberado — lançar despesa a partir de um estado que o
servidor não conhece gera número errado.

### A tela (folha de tela cheia no mobile, dialog no desktop)

**1. Quanto deu.** Campo de valor grande, `inputMode="decimal"`, foco automático.

- Se **todos** os itens no carrinho tiverem preço, o campo vem **somado e editável**.
- Se **alguns** tiverem, não preenche nada — mostra *"R$ 87,40 anotados em 8 de 24 itens"*
  como referência. Preencher parcialmente seria pior que não preencher.

**2. Como pagou.** Data (hoje), forma de pagamento e classificação, reaproveitando os
campos do `despesa-form-dialog`:

- **Sem cartão** → `lancamentos` com `tipo = 'despesa_avulsa'`, `data_referencia` = dia 1
  do mês da data, `quinzena` = 15 se o dia ≤ 15, senão 30.
- **Com cartão** → `compras_cartao` à vista (`parcelas = 1`, `parcelas_ja_pagas = 0`).

Categoria e "quem gastou" vêm **pré-selecionados com o que foi usado na última lista
finalizada**. Não há categoria "Mercado" nas seeds — as categorias são criadas pelo
usuário — então o padrão é aprendido, não chutado. Na segunda ida o bloco já vem certo.

**3. O que sobrou.** Dois grupos rotulados, porque a razão de cada um é diferente:

- **"Não encontrei"** — os arrastados. Cada um com *levar pra próxima* **já marcado**.
- **"Não peguei"** — os que ficaram pendentes. Também já marcados.

O usuário só desmarca o que desistiu. Se não sobrou nada, o bloco some.

### O que acontece ao confirmar

São quatro escritas que **não podem falhar pela metade**: se a despesa entrar e a lista não
fechar, uma segunda tentativa lança a despesa duas vezes. Por isso não vão como quatro
chamadas do cliente Supabase, e sim como **uma função Postgres chamada por `rpc`** — uma
transação, tudo ou nada.

```sql
create or replace function public.finalizar_lista_mercado(
  p_lista_id     uuid,
  p_total        numeric,
  p_data         date,
  p_cartao_id    uuid,      -- null = despesa avulsa
  p_quinzena     smallint,  -- usado só quando p_cartao_id is null
  p_categoria_id uuid,
  p_quem_gastou  text,
  p_descricao    text,
  p_manter       uuid[]     -- ids dos itens que vão pra próxima lista
) returns uuid               -- id da lista nova
language plpgsql
security invoker             -- continua passando por RLS como o usuário
set search_path = public
as $func$ ... $func$;
```

Passos, na ordem:

1. Confere que a lista está mesmo `aberta` — protege contra toque duplo e contra duas abas.
2. Cria a despesa em `lancamentos` **ou** em `compras_cartao`, conforme `p_cartao_id`.
3. Fecha a lista: `status = 'finalizada'`, `finalizada_em`, `total`, e a FK apontando pra
   despesa criada.
4. Cria a **próxima lista** (já `aberta`) e copia os itens de `p_manter` pra ela com
   `status = 'pendente'`, `faltou_antes = true`, `preco = null` e `ordem` renumerada.

A função é `security invoker`, então RLS continua valendo — nenhuma brecha de escopo. E o
índice único parcial garante que o passo 4 só pode acontecer depois do passo 3: o banco
impede duas listas abertas.

A server action que chama a `rpc` revalida `/mercado`, `/mercado/historico`, `/despesas`,
`/relatorios/compras-do-mes` e `/`. No fim, o usuário cai na lista nova, com o que sobrou
já dentro.

### Omissão deliberada: não há "reabrir compra"

Desfazer um fechamento significaria apagar a despesa gerada e a lista nova (que já pode
ter sido usada) — muita máquina pra um caso raro. Total errado se corrige editando a
despesa em `/despesas`, como qualquer outra.

---

## 8. Bordas e erros

- **Item repetido** — digitar "leite" com "Leite" já na lista não cria segunda linha
  (comparação por nome normalizado: minúsculas, sem acento, sem espaço nas pontas). A linha
  existente pisca e a tela rola até ela. No corredor, duplicata é sempre engano.
- **Bloco de cadastro** — linhas em branco são descartadas, repetidas dentro do bloco
  colapsam, e a ordem de digitação vira a `ordem`.
- **Parser de quantidade, conservador** — reconhece `2x leite`, `leite 2x` e `arroz 5kg`
  (número seguido de unidade conhecida: kg, g, l, ml, un, pct, cx, dz). **Na dúvida, a
  frase inteira vira o nome.** Parser esperto errando é pior que parser bobo acertando.
- **`localStorage` indisponível** (aba anônima, cota cheia) — a fila degrada pra memória e
  o indicador passa a mostrar apenas *salvo no servidor*. Nada quebra, mas fechar a aba sem
  rede perde o que não subiu, e o usuário fica sabendo.
- **Lista vazia** não pode ser finalizada.
- **Total obrigatório e maior que zero** — a compra vira despesa; fechar sem valor deixaria
  o app mentindo sobre o mês.
- **Toque duplo em "Finalizar"** é barrado no banco (a função confere `status = 'aberta'`),
  não só no cliente.
- **Pagamento dividido** (metade cartão, metade débito) não cabe: é uma despesa por lista.
  A segunda metade se lança à mão em `/despesas`. Limitação aceita.
- **Erros** reaproveitam `erroAmigavel` de `src/lib/acoes.ts`, como todas as actions do app.

---

## 9. Verificação

**Vitest** entra como dev dependency, com um `vitest.config.ts` mínimo e o script
`"test": "vitest run"`. Fica preso na **linha 3** de propósito: a 5 exige `@types/node` ≥22
e o projeto está no `^20` — não vale mexer no toolchain inteiro por causa de um runner de
teste. Testes **só nas três funções puras** — as que erram calado:

1. **`parseBlocoDeItens(texto)`** — linhas em branco, duplicatas, vírgulas, e cada caso do
   parser de quantidade, incluindo os casos em que ele deve desistir e devolver a frase
   inteira.
2. **`aplicarFilaLocal(itensDoServidor, fila)`** — a fila ganha nos itens que toca, o
   servidor ganha no resto; item da fila que não existe mais no servidor; fila vazia.
3. **`calcularTotalSugerido(itens)`** — soma quando todos os itens do carrinho têm preço,
   devolve "sem sugestão" quando algum não tem, ignora itens fora do carrinho.

Sem teste de componente e sem mock de Supabase: mock de cliente de banco envelhece mal e
não paga a manutenção num app de duas pessoas.

**Roteiro manual complementar**, uma vez, antes de considerar pronto: cadastrar em bloco no
desktop → abrir no celular → marcar alguns, arrastar outros → **ativar modo avião e
continuar marcando** → voltar a rede e conferir que sincronizou → finalizar → conferir a
despesa em `/despesas` e a lista nova com os itens mantidos.

---

## 10. Fora de escopo (registrado de propósito)

- Offline-first de verdade (service worker + IndexedDB). A fila da seção 6 é o caminho
  pronto pra isso, se um dia fizer falta.
- Realtime entre os dois celulares.
- Agrupamento por setor do mercado.
- Múltiplas listas nomeadas (Atacadão, feira, farmácia).
- Reabrir uma compra finalizada.
- Pagamento dividido em duas formas.

---

## 11. Arquivos afetados

**Novos:**

```
supabase/migrations/0015_lista_mercado.sql
src/app/(app)/mercado/page.tsx
src/app/(app)/mercado/loading.tsx
src/app/(app)/mercado/actions.ts
src/app/(app)/mercado/lista-cliente.tsx          -- estado local + fila
src/app/(app)/mercado/item-linha.tsx             -- linha + swipe
src/app/(app)/mercado/use-swipe-item.ts
src/app/(app)/mercado/campo-adicionar-item.tsx   -- autocomplete
src/app/(app)/mercado/bloco-de-itens.tsx         -- cadastro em massa
src/app/(app)/mercado/item-detalhe-sheet.tsx     -- quantidade/preço/remover
src/app/(app)/mercado/finalizar-dialog.tsx
src/app/(app)/mercado/nova-lista-botao.tsx     -- estado vazio
src/app/(app)/mercado/historico/page.tsx
src/app/(app)/mercado/[id]/page.tsx
src/lib/mercado.ts                               -- as 3 funções puras + tipos
src/lib/mercado-fila.ts                          -- fila + localStorage
src/lib/mercado.test.ts
vitest.config.ts
```

**Alterados:**

```
src/components/nav/nav-items.ts       -- +Mercado no bottom-nav, Rendas vira desktopOnly
src/components/nav/mobile-fab.tsx     -- esconder o FAB em /mercado
package.json                          -- vitest + script "test"
```
