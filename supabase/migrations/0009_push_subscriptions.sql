-- =====================================================================
-- Push subscriptions — lembretes de vencimento via Web Push
-- =====================================================================
-- Cada linha é uma inscrição de push de um navegador/aparelho específico
-- de um profile. Um casal pode ter várias (os dois parceiros, ou o mesmo
-- parceiro em mais de um aparelho) — o cron de lembretes envia pra todas
-- as inscrições do casal.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  casal_id    uuid not null references public.casais(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_casal_id_idx on public.push_subscriptions(casal_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_scope" on public.push_subscriptions;
create policy "push_subscriptions_scope" on public.push_subscriptions
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
