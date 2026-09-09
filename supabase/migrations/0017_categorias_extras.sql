-- =====================================================================
-- Categorias extras — mais de uma categoria por compra/despesa
-- =====================================================================
-- `categoria_id` continua sendo a categoria PRINCIPAL, e é ela que os
-- relatórios de soma (gastos-por-categoria, categoria-por-mes,
-- maiores-gastos, comprometimento-futuro) agrupam. Esta tabela guarda as
-- categorias ADICIONAIS, que servem pra classificar melhor e pra filtrar
-- — nunca pra somar.
--
-- A assimetria é de propósito. Se as categorias fossem todas iguais, uma
-- compra de R$ 300 em Mercado+Farmácia teria que virar R$ 600 na soma
-- (errado) ou R$ 150 em cada (também errado, porque a compra foi mesmo
-- toda no mercado). Mantendo uma principal, todo número que já existe
-- continua valendo.
--
-- Só `lancamentos` e `compras_cartao` participam: são os lançamentos
-- avulsos, os que de fato misturam categorias. Conta fixa e assinatura
-- são definições recorrentes, onde uma categoria basta.
--
-- Idempotente: pode rodar inteiro no SQL Editor mais de uma vez.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
-- Duas FKs anuláveis + check, em vez de um par polimórfico (tipo, id).
-- Custa uma coluna a mais e paga com integridade real: excluir a compra,
-- o lançamento ou a categoria limpa as extras sozinho, pelo cascade. Com
-- id solto eu teria que lembrar de limpar na mão em cinco lugares.

create table if not exists public.categorias_extras (
  id               uuid primary key default gen_random_uuid(),
  casal_id         uuid not null default public.current_casal_id()
                     references public.casais(id) on delete cascade,
  categoria_id     uuid not null
                     references public.categorias(id) on delete cascade,
  lancamento_id    uuid references public.lancamentos(id)    on delete cascade,
  compra_cartao_id uuid references public.compras_cartao(id) on delete cascade,
  criado_por       uuid default auth.uid()
                     references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),

  -- Exatamente um alvo. Sem isto daria pra gravar uma extra órfã (nenhum
  -- dos dois) ou grudada em dois lançamentos ao mesmo tempo.
  constraint categorias_extras_um_alvo
    check (num_nonnulls(lancamento_id, compra_cartao_id) = 1),

  -- Uniques comuns, não parciais: `ON CONFLICT` só sabe inferir índice
  -- parcial se a query repetir o predicado, o que o PostgREST não expressa.
  -- Como NULL não conflita com NULL no Postgres, as linhas de compra
  -- (lancamento_id null) não brigam entre si nesta primeira constraint —
  -- quem cuida delas é a segunda.
  constraint categorias_extras_lancamento_uk unique (lancamento_id, categoria_id),
  constraint categorias_extras_compra_uk     unique (compra_cartao_id, categoria_id)
);

create index if not exists categorias_extras_casal_id_idx
  on public.categorias_extras(casal_id);
create index if not exists categorias_extras_categoria_id_idx
  on public.categorias_extras(categoria_id);


-- ---------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------
-- Mesmo formato da 0013/0016: `to authenticated` e `(select ...)` pra que
-- a função de escopo vire InitPlan e rode uma vez por query, não por linha.

alter table public.categorias_extras enable row level security;

drop policy if exists "categorias_extras_scope" on public.categorias_extras;
create policy "categorias_extras_scope" on public.categorias_extras
  for all to authenticated
  using      (casal_id = (select public.current_casal_id()))
  with check (casal_id = (select public.current_casal_id()));


-- ---------------------------------------------------------------------
-- 3. Integridade: FK não atravessa casal
-- ---------------------------------------------------------------------
-- A checagem de foreign key roda como dona da tabela e NÃO passa por RLS.
-- Sem estas triggers dá pra gravar uma extra com casal_id próprio
-- apontando pra categoria (ou pro lançamento) de outro casal. Mesma
-- função da 0013 — ela já ignora FK nula, que é o caso normal aqui, já
-- que só um dos dois alvos é preenchido.

drop trigger if exists categorias_extras_mesmo_casal_categoria on public.categorias_extras;
create trigger categorias_extras_mesmo_casal_categoria
  before insert or update on public.categorias_extras
  for each row execute function public.assert_mesmo_casal('categorias', 'categoria_id');

drop trigger if exists categorias_extras_mesmo_casal_lancamento on public.categorias_extras;
create trigger categorias_extras_mesmo_casal_lancamento
  before insert or update on public.categorias_extras
  for each row execute function public.assert_mesmo_casal('lancamentos', 'lancamento_id');

drop trigger if exists categorias_extras_mesmo_casal_compra on public.categorias_extras;
create trigger categorias_extras_mesmo_casal_compra
  before insert or update on public.categorias_extras
  for each row execute function public.assert_mesmo_casal('compras_cartao', 'compra_cartao_id');
