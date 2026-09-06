-- =====================================================================
-- Vigência das rendas fixas — outubro/2026
-- =====================================================================
-- Até aqui `rendas` não tinha recorte de tempo: toda renda ativa entrava no
-- cálculo de TODOS os meses, passados e futuros. Cadastrar hoje o salário de
-- um emprego que começa em outubro reescrevia setembro, agosto e todo o
-- histórico dos relatórios.
--
-- `contas_recorrentes` e `assinaturas_cartao` já resolvem isso com
-- `inicio_vigencia` / `fim_vigencia`. Esta migration dá o mesmo par às rendas.
--
-- Backfill: as rendas que já existem recebem `1900-01-01`, uma data anterior
-- a qualquer mês que o app consiga exibir. Assim elas continuam valendo em
-- todos os meses e nenhum número muda — a coluna nova só afeta o que for
-- cadastrado daqui pra frente.
--
-- A comparação no app é sempre por MÊS (sobreposição de faixas), então o dia
-- gravado não muda resultado: o formulário grava o primeiro dia do mês de
-- início e o último dia do mês de fim.
--
-- Idempotente: `add column if not exists` + backfill só do que está nulo.
-- =====================================================================

alter table public.rendas
  add column if not exists inicio_vigencia date,
  add column if not exists fim_vigencia    date;

update public.rendas
   set inicio_vigencia = date '1900-01-01'
 where inicio_vigencia is null;

alter table public.rendas
  alter column inicio_vigencia set not null,
  -- Default = primeiro dia do mês corrente. Só entra em jogo se alguém
  -- inserir pelo SQL; o formulário sempre manda a coluna.
  alter column inicio_vigencia set default date_trunc('month', current_date)::date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rendas_vigencia_check'
  ) then
    alter table public.rendas
      add constraint rendas_vigencia_check
      check (fim_vigencia is null or fim_vigencia >= inicio_vigencia);
  end if;
end $$;

-- O dashboard e os relatórios filtram por "vigente no mês X", que em SQL vira
-- `inicio_vigencia <= <último dia> and (fim_vigencia is null or fim_vigencia
-- >= <primeiro dia>)`. A tabela é pequena (uma linha por fonte de renda do
-- casal), então o seq scan já é o plano certo e não vale um índice novo.
