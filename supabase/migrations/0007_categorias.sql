-- =====================================================================
-- Categorias — cadastro reutilizável por casal
-- =====================================================================
-- Substitui o campo `categoria text` livre por uma tabela dedicada. Os
-- valores antigos são preservados automaticamente: a migration coleta
-- os textos distintos já existentes, cria uma `categoria` por nome único
-- e amarra os registros antigos ao novo `categoria_id`.
--
-- A coluna `categoria` (text) fica no banco por enquanto como fallback
-- de exibição — pode ser removida numa migration futura.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------

create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  casal_id   uuid not null references public.casais(id) on delete cascade,
  nome       text not null,
  cor        text not null default '#c67139',
  emoji      text,
  created_at timestamptz not null default now(),
  unique (casal_id, nome)
);

create index if not exists categorias_casal_id_idx on public.categorias(casal_id);

-- ---------------------------------------------------------------------
-- FKs nas tabelas existentes
-- ---------------------------------------------------------------------

alter table public.contas_recorrentes
  add column if not exists categoria_id uuid references public.categorias(id) on delete set null;

alter table public.lancamentos
  add column if not exists categoria_id uuid references public.categorias(id) on delete set null;

alter table public.compras_cartao
  add column if not exists categoria_id uuid references public.categorias(id) on delete set null;

alter table public.assinaturas_cartao
  add column if not exists categoria_id uuid references public.categorias(id) on delete set null;

create index if not exists contas_recorrentes_categoria_id_idx  on public.contas_recorrentes(categoria_id);
create index if not exists lancamentos_categoria_id_idx         on public.lancamentos(categoria_id);
create index if not exists compras_cartao_categoria_id_idx      on public.compras_cartao(categoria_id);
create index if not exists assinaturas_cartao_categoria_id_idx  on public.assinaturas_cartao(categoria_id);

-- ---------------------------------------------------------------------
-- Seed automático a partir dos textos que já existem
-- ---------------------------------------------------------------------
-- Coleta distinct(casal_id, nome) das 4 tabelas e cria uma categoria por
-- nome único de cada casal. Ignora vazios/nulls. `on conflict do nothing`
-- evita duplicar entre as 4 fontes.

insert into public.categorias (casal_id, nome)
select distinct casal_id, trim(categoria)
from public.contas_recorrentes
where categoria is not null and trim(categoria) <> ''
on conflict (casal_id, nome) do nothing;

insert into public.categorias (casal_id, nome)
select distinct casal_id, trim(categoria)
from public.lancamentos
where categoria is not null and trim(categoria) <> ''
on conflict (casal_id, nome) do nothing;

insert into public.categorias (casal_id, nome)
select distinct casal_id, trim(categoria)
from public.compras_cartao
where categoria is not null and trim(categoria) <> ''
on conflict (casal_id, nome) do nothing;

insert into public.categorias (casal_id, nome)
select distinct casal_id, trim(categoria)
from public.assinaturas_cartao
where categoria is not null and trim(categoria) <> ''
on conflict (casal_id, nome) do nothing;

-- ---------------------------------------------------------------------
-- Amarração automática: `categoria` (text) → `categoria_id`
-- ---------------------------------------------------------------------

update public.contas_recorrentes cr
set categoria_id = c.id
from public.categorias c
where cr.casal_id = c.casal_id
  and trim(cr.categoria) = c.nome
  and cr.categoria_id is null;

update public.lancamentos l
set categoria_id = c.id
from public.categorias c
where l.casal_id = c.casal_id
  and trim(l.categoria) = c.nome
  and l.categoria_id is null;

update public.compras_cartao cc
set categoria_id = c.id
from public.categorias c
where cc.casal_id = c.casal_id
  and trim(cc.categoria) = c.nome
  and cc.categoria_id is null;

update public.assinaturas_cartao ac
set categoria_id = c.id
from public.categorias c
where ac.casal_id = c.casal_id
  and trim(ac.categoria) = c.nome
  and ac.categoria_id is null;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.categorias enable row level security;

drop policy if exists "categorias_scope" on public.categorias;
create policy "categorias_scope" on public.categorias
  for all
  using (casal_id = public.current_casal_id())
  with check (casal_id = public.current_casal_id());
