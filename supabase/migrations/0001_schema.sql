-- =====================================================================
-- Sistema de Controle Financeiro do Casal — Schema Inicial
-- =====================================================================
-- Cinco tabelas:
--   casais            → agrupa os 2 usuários
--   profiles          → 1:1 com auth.users, aponta para casais
--   rendas            → rendas mensais (adiantamento dia 15, salário dia 30)
--   contas_recorrentes→ template de contas fixas (aluguel, luz, etc.)
--   lancamentos       → contas efetivamente pagas + despesas avulsas
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table if not exists public.casais (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  casal_id   uuid not null references public.casais(id) on delete cascade,
  nome       text not null,
  papel      text not null check (papel in ('titular', 'conjuge')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_casal_id_idx on public.profiles(casal_id);

create table if not exists public.rendas (
  id               uuid primary key default gen_random_uuid(),
  casal_id         uuid not null references public.casais(id) on delete cascade,
  descricao        text not null,
  valor_previsto   numeric(12,2) not null check (valor_previsto >= 0),
  dia_recebimento  smallint not null check (dia_recebimento in (15, 30)),
  ativa            boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists rendas_casal_id_idx on public.rendas(casal_id);

create table if not exists public.contas_recorrentes (
  id                uuid primary key default gen_random_uuid(),
  casal_id          uuid not null references public.casais(id) on delete cascade,
  descricao         text not null,
  valor_previsto    numeric(12,2) not null check (valor_previsto >= 0),
  quinzena          smallint not null check (quinzena in (15, 30)),
  dia_vencimento    smallint check (dia_vencimento between 1 and 31),
  categoria         text,
  inicio_vigencia   date not null default current_date,
  fim_vigencia      date,
  ativa             boolean not null default true,
  created_at        timestamptz not null default now(),
  check (fim_vigencia is null or fim_vigencia >= inicio_vigencia)
);

create index if not exists contas_recorrentes_casal_id_idx on public.contas_recorrentes(casal_id);

create table if not exists public.lancamentos (
  id                    uuid primary key default gen_random_uuid(),
  casal_id              uuid not null references public.casais(id) on delete cascade,
  tipo                  text not null check (tipo in ('conta_fixa', 'despesa_avulsa', 'renda_extra')),
  descricao             text not null,
  valor                 numeric(12,2) not null check (valor >= 0),
  data_referencia       date not null,
  data_pagamento        date,
  quinzena              smallint check (quinzena in (15, 30)),
  categoria             text,
  conta_recorrente_id   uuid references public.contas_recorrentes(id) on delete set null,
  criado_por            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists lancamentos_casal_id_idx on public.lancamentos(casal_id);
create index if not exists lancamentos_data_ref_idx on public.lancamentos(casal_id, data_referencia);

-- Evita marcar a mesma conta recorrente 2x no mesmo mês (data_referencia deve ser o primeiro dia do mês)
create unique index if not exists lancamentos_recorrente_mes_unico
  on public.lancamentos (conta_recorrente_id, data_referencia)
  where conta_recorrente_id is not null;

-- ---------------------------------------------------------------------
-- Função helper para RLS: retorna o casal_id do usuário autenticado
-- ---------------------------------------------------------------------
-- security definer é essencial para que a função possa ler public.profiles
-- mesmo com RLS ativo. O search_path fica travado por segurança.

create or replace function public.current_casal_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select casal_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.casais              enable row level security;
alter table public.profiles            enable row level security;
alter table public.rendas              enable row level security;
alter table public.contas_recorrentes  enable row level security;
alter table public.lancamentos         enable row level security;

-- casais: usuário só vê o casal ao qual pertence
drop policy if exists "casais_scope" on public.casais;
create policy "casais_scope" on public.casais
  for all
  using (id = public.current_casal_id())
  with check (id = public.current_casal_id());

-- profiles: usuário vê o próprio profile e o do parceiro (mesmo casal)
drop policy if exists "profiles_scope" on public.profiles;
create policy "profiles_scope" on public.profiles
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());

-- rendas, contas_recorrentes, lancamentos: escopo por casal
drop policy if exists "rendas_scope" on public.rendas;
create policy "rendas_scope" on public.rendas
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());

drop policy if exists "contas_recorrentes_scope" on public.contas_recorrentes;
create policy "contas_recorrentes_scope" on public.contas_recorrentes
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());

drop policy if exists "lancamentos_scope" on public.lancamentos;
create policy "lancamentos_scope" on public.lancamentos
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
