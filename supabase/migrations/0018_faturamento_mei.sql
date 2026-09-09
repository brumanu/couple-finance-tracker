-- =====================================================================
-- Faturamento MEI — notas emitidas
-- =====================================================================
-- Registro do que o MEI faturou: pra quem emitiu, quanto e quando. Não
-- se mistura com `rendas` (salário/renda fixa do casal) nem com
-- `lancamentos`: aqui o que importa é o faturamento bruto da empresa, que
-- tem uma regra própria — o limite anual do MEI.
--
-- `data_emissao` é a data da nota, e é por ela que o ano-calendário do
-- limite é contado. Sem vínculo com mês/quinzena: faturamento não segue
-- o ciclo doméstico das outras telas.
-- =====================================================================

create table if not exists public.notas_mei (
  id            uuid primary key default gen_random_uuid(),
  casal_id      uuid not null references public.casais(id) on delete cascade,
  empresa       text not null,
  valor         numeric(12,2) not null check (valor >= 0),
  data_emissao  date not null,
  criado_por    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists notas_mei_casal_id_idx
  on public.notas_mei(casal_id);
-- A tela sempre lista/soma por ano-calendário.
create index if not exists notas_mei_data_idx
  on public.notas_mei(casal_id, data_emissao desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.notas_mei enable row level security;

drop policy if exists "notas_mei_scope" on public.notas_mei;
create policy "notas_mei_scope" on public.notas_mei
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
