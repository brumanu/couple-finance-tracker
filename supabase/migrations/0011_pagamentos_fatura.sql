-- =====================================================================
-- Pagamentos de fatura de cartão — "já paguei essa fatura"
-- =====================================================================
-- As faturas já apareciam em "Contas da quinzena" no dashboard, mas só
-- como link pro cartão: não dava pra marcar como paga igual às contas
-- fixas, então não servia de checklist do que falta pagar no mês.
--
-- Por que tabela própria em vez de um `lancamentos` de tipo novo: o
-- valor da fatura já é derivado de compras_cartao + assinaturas_cartao,
-- e todo relatório que soma gastos lê `lancamentos`. Inserir o pagamento
-- lá contaria a fatura duas vezes (uma pelas compras, outra pelo
-- pagamento). Aqui a linha é só o registro de "quitada", sem entrar em
-- nenhuma soma de gastos.
--
-- `mes_referencia` é sempre o dia 1 do mês da fatura — mesma convenção
-- de `lancamentos.data_referencia` pra contas fixas. O unique garante
-- que a mesma fatura não seja marcada duas vezes.
-- =====================================================================

create table if not exists public.pagamentos_fatura (
  id              uuid primary key default gen_random_uuid(),
  casal_id        uuid not null references public.casais(id) on delete cascade,
  cartao_id       uuid not null references public.cartoes(id) on delete cascade,
  mes_referencia  date not null,
  valor           numeric(12,2) not null check (valor >= 0),
  data_pagamento  date,
  criado_por      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (cartao_id, mes_referencia)
);

create index if not exists pagamentos_fatura_casal_id_idx
  on public.pagamentos_fatura(casal_id);
create index if not exists pagamentos_fatura_mes_idx
  on public.pagamentos_fatura(casal_id, mes_referencia);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.pagamentos_fatura enable row level security;

drop policy if exists "pagamentos_fatura_scope" on public.pagamentos_fatura;
create policy "pagamentos_fatura_scope" on public.pagamentos_fatura
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
