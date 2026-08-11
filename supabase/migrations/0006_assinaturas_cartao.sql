-- =====================================================================
-- Assinaturas do cartão — cobranças recorrentes indefinidas
-- =====================================================================
-- Netflix, Spotify, ChatGPT, mensalidades etc. Se repete todo mês na
-- fatura até ser cancelada. Diferente de compras parceladas (que têm
-- fim previsível) e de contas_recorrentes (que são pagas fora do
-- cartão de crédito).
--
-- Regra de vigência (igual contas_recorrentes):
--   ativa AND inicio_vigencia <= fim do mês AND
--   (fim_vigencia is null OR fim_vigencia >= início do mês)
-- =====================================================================

create table if not exists public.assinaturas_cartao (
  id                uuid primary key default gen_random_uuid(),
  casal_id          uuid not null references public.casais(id) on delete cascade,
  cartao_id         uuid not null references public.cartoes(id) on delete cascade,
  descricao         text not null,
  valor_mensal      numeric(12,2) not null check (valor_mensal >= 0),
  categoria         text,
  inicio_vigencia   date not null default current_date,
  fim_vigencia      date,
  ativa             boolean not null default true,
  criada_por        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  check (fim_vigencia is null or fim_vigencia >= inicio_vigencia)
);

create index if not exists assinaturas_cartao_casal_id_idx
  on public.assinaturas_cartao(casal_id);
create index if not exists assinaturas_cartao_cartao_id_idx
  on public.assinaturas_cartao(cartao_id);

-- RLS
alter table public.assinaturas_cartao enable row level security;

drop policy if exists "assinaturas_cartao_scope" on public.assinaturas_cartao;
create policy "assinaturas_cartao_scope" on public.assinaturas_cartao
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
