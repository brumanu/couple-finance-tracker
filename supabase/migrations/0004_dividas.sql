-- =====================================================================
-- Dívidas — cadastro manual pra não esquecer, com pagamentos parciais
-- =====================================================================
-- Pagamentos ficam numa tabela dedicada (não em lancamentos) porque não
-- devem impactar o cálculo de saldo da quinzena — dívidas têm vida
-- própria, aparecem só na tela /dividas e num card resumo no dashboard.
-- "Quitada" é calculado em runtime: sum(pagamentos.valor) >= valor_total.
-- =====================================================================

-- ---------------------------------------------------------------------
-- dividas
-- ---------------------------------------------------------------------

create table if not exists public.dividas (
  id           uuid primary key default gen_random_uuid(),
  casal_id     uuid not null references public.casais(id) on delete cascade,
  descricao    text not null,
  valor_total  numeric(12,2) not null check (valor_total > 0),
  created_at   timestamptz not null default now()
);

create index if not exists dividas_casal_id_idx on public.dividas(casal_id);

-- ---------------------------------------------------------------------
-- pagamentos_divida
-- ---------------------------------------------------------------------

create table if not exists public.pagamentos_divida (
  id              uuid primary key default gen_random_uuid(),
  casal_id        uuid not null references public.casais(id) on delete cascade,
  divida_id       uuid not null references public.dividas(id) on delete cascade,
  valor           numeric(12,2) not null check (valor > 0),
  data_pagamento  date not null default current_date,
  observacao      text,
  criado_por      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists pagamentos_divida_casal_id_idx on public.pagamentos_divida(casal_id);
create index if not exists pagamentos_divida_divida_id_idx on public.pagamentos_divida(divida_id);
create index if not exists pagamentos_divida_data_idx on public.pagamentos_divida(divida_id, data_pagamento);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.dividas             enable row level security;
alter table public.pagamentos_divida   enable row level security;

drop policy if exists "dividas_scope" on public.dividas;
create policy "dividas_scope" on public.dividas
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());

drop policy if exists "pagamentos_divida_scope" on public.pagamentos_divida;
create policy "pagamentos_divida_scope" on public.pagamentos_divida
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
