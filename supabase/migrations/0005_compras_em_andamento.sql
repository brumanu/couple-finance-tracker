-- =====================================================================
-- Compras em andamento — parcelas já pagas antes de cadastrar
-- =====================================================================
-- Pra quando o usuário lança uma compra que já vem rodando de meses
-- atrás. Ex: iPhone comprado em maio, 12x; hoje em agosto ele já pagou
-- 3 parcelas. Cadastra a compra com parcelas_ja_pagas=3 e o sistema
-- só considera as parcelas 4 a 12 daqui pra frente.
-- =====================================================================

alter table public.compras_cartao
  add column if not exists parcelas_ja_pagas smallint not null default 0
    check (parcelas_ja_pagas >= 0);

-- Consistência: parcelas_ja_pagas nunca pode ser maior que parcelas
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'compras_cartao_pagas_menor_total_check'
  ) then
    alter table public.compras_cartao
      add constraint compras_cartao_pagas_menor_total_check
      check (parcelas_ja_pagas < parcelas);
  end if;
end $$;
