-- =====================================================================
-- Bancos: adicionar coluna 'icone' para seletor visual de marca
-- =====================================================================
-- Nullable pra não quebrar linhas existentes; UI cai no avatar de
-- iniciais + cor quando icone é null.
-- =====================================================================

alter table public.bancos
  add column if not exists icone text;

-- Valida ids permitidos via check constraint (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bancos_icone_check'
  ) then
    alter table public.bancos
      add constraint bancos_icone_check
      check (icone is null or icone in ('nubank','itau','picpay','mercadopago','c6'));
  end if;
end $$;
