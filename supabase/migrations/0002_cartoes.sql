-- =====================================================================
-- Cartões de crédito — bancos, cartões e compras parceladas
-- =====================================================================
-- Regra: a distribuição de parcelas por mês é CALCULADA em runtime a
-- partir de compras_cartao (data_compra, parcelas) + cartoes.dia_fechamento.
-- Não materializamos parcelas — mesma filosofia de contas_recorrentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- bancos
-- ---------------------------------------------------------------------

create table if not exists public.bancos (
  id         uuid primary key default gen_random_uuid(),
  casal_id   uuid not null references public.casais(id) on delete cascade,
  nome       text not null,
  cor        text not null default '#c67139', -- hex; usado como fundo do avatar do banco
  created_at timestamptz not null default now()
);

create index if not exists bancos_casal_id_idx on public.bancos(casal_id);

-- ---------------------------------------------------------------------
-- cartoes
-- ---------------------------------------------------------------------

create table if not exists public.cartoes (
  id                uuid primary key default gen_random_uuid(),
  casal_id          uuid not null references public.casais(id) on delete cascade,
  banco_id          uuid not null references public.bancos(id) on delete restrict,
  apelido           text,                                     -- ex: "Platinum" (opcional)
  bandeira          text check (bandeira in ('visa','master','elo','amex','hipercard','outra')),
  dia_fechamento    smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento    smallint not null check (dia_vencimento between 1 and 31),
  ativo             boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists cartoes_casal_id_idx on public.cartoes(casal_id);
create index if not exists cartoes_banco_id_idx on public.cartoes(banco_id);

-- ---------------------------------------------------------------------
-- compras_cartao
-- ---------------------------------------------------------------------

create table if not exists public.compras_cartao (
  id            uuid primary key default gen_random_uuid(),
  casal_id      uuid not null references public.casais(id) on delete cascade,
  cartao_id     uuid not null references public.cartoes(id) on delete cascade,
  descricao     text not null,
  valor_total   numeric(12,2) not null check (valor_total >= 0),
  data_compra   date not null,
  parcelas      smallint not null default 1 check (parcelas between 1 and 60),
  categoria     text,
  criado_por    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists compras_cartao_casal_id_idx on public.compras_cartao(casal_id);
create index if not exists compras_cartao_cartao_id_idx on public.compras_cartao(cartao_id);
create index if not exists compras_cartao_data_idx on public.compras_cartao(cartao_id, data_compra);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.bancos          enable row level security;
alter table public.cartoes         enable row level security;
alter table public.compras_cartao  enable row level security;

drop policy if exists "bancos_scope" on public.bancos;
create policy "bancos_scope" on public.bancos
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());

drop policy if exists "cartoes_scope" on public.cartoes;
create policy "cartoes_scope" on public.cartoes
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());

drop policy if exists "compras_cartao_scope" on public.compras_cartao;
create policy "compras_cartao_scope" on public.compras_cartao
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
