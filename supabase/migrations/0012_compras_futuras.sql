-- =====================================================================
-- Compras futuras — a lista de "queremos comprar"
-- =====================================================================
-- Diferente de todo o resto do app, aqui nada aconteceu ainda: é uma
-- lista de intenção, não de gasto. Por isso `valor_estimado` é nullable
-- (dá pra anotar "sofá novo" sem fazer ideia do preço) e não existe
-- data — o item fica na lista até virar compra ou ser descartado.
--
-- Não entra em nenhuma soma de gastos do app: só vira dinheiro de
-- verdade quando o item é marcado como comprado e (opcionalmente)
-- lançado como despesa/compra no cartão.
--
-- `prioridade`: 1 alta, 2 média, 3 baixa — smallint em vez de enum pra
-- ordenar direto no banco sem cast.
-- `quem_quer` segue a mesma convenção de `quem_gastou`: uuid de profile
-- ou o literal 'casal'.
-- =====================================================================

create table if not exists public.compras_futuras (
  id             uuid primary key default gen_random_uuid(),
  casal_id       uuid not null references public.casais(id) on delete cascade,
  descricao      text not null,
  valor_estimado numeric(12,2) check (valor_estimado >= 0),
  prioridade     smallint not null default 2 check (prioridade in (1, 2, 3)),
  categoria      text,
  categoria_id   uuid references public.categorias(id) on delete set null,
  quem_quer      text,
  link           text,
  observacao     text,
  comprado_em    date,
  criado_por     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists compras_futuras_casal_id_idx
  on public.compras_futuras(casal_id);
-- Lista padrão = itens em aberto, ordenados por prioridade.
create index if not exists compras_futuras_abertas_idx
  on public.compras_futuras(casal_id, prioridade)
  where comprado_em is null;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.compras_futuras enable row level security;

drop policy if exists "compras_futuras_scope" on public.compras_futuras;
create policy "compras_futuras_scope" on public.compras_futuras
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
