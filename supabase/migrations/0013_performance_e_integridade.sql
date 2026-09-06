-- =====================================================================
-- Performance e integridade — revisão de setembro/2026
-- =====================================================================
-- Três blocos independentes, todos idempotentes:
--   1. Policies RLS reescritas com (select current_casal_id())
--   2. Índices para os filtros que as telas realmente usam
--   3. Trigger que impede apontar FK para registro de outro casal
--
-- Nada aqui muda dado existente. Pode rodar inteiro no SQL Editor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. RLS: avaliar current_casal_id() uma vez por query, não por linha
-- ---------------------------------------------------------------------
-- Sem o (select ...), o Postgres pode reavaliar a função a cada linha
-- examinada. Com o wrapper ele a trata como InitPlan e roda uma vez só.
-- O `to authenticated` também evita rodar a policy para o papel anon.

do $$
declare
  t text;
  tabelas text[] := array[
    'rendas', 'contas_recorrentes', 'lancamentos', 'bancos', 'cartoes',
    'compras_cartao', 'dividas', 'pagamentos_divida', 'assinaturas_cartao',
    'categorias', 'push_subscriptions', 'pagamentos_fatura', 'compras_futuras'
  ];
begin
  foreach t in array tabelas loop
    -- Só mexe no que existe (o banco pode estar numa migration anterior).
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', t || '_scope', t);
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (casal_id = (select public.current_casal_id()))
        with check (casal_id = (select public.current_casal_id()))
    $f$, t || '_scope', t);
  end loop;
end $$;

-- casais e profiles têm coluna de escopo diferente das demais.
drop policy if exists "casais_scope" on public.casais;
create policy "casais_scope" on public.casais
  for all to authenticated
  using (id = (select public.current_casal_id()))
  with check (id = (select public.current_casal_id()));

drop policy if exists "profiles_scope" on public.profiles;
create policy "profiles_scope" on public.profiles
  for all to authenticated
  using (casal_id = (select public.current_casal_id()))
  with check (casal_id = (select public.current_casal_id()));

-- A função de escopo não precisa ficar exposta ao papel anon.
revoke execute on function public.current_casal_id() from public, anon;
grant execute on function public.current_casal_id() to authenticated;


-- ---------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------

-- Toda leitura de lançamento filtra tipo + faixa de data_referencia
-- (dashboard, /despesas, /rendas e os 9 relatórios).
create index if not exists lancamentos_casal_tipo_data_idx
  on public.lancamentos (casal_id, tipo, data_referencia desc);

-- compras_cartao: o índice existente é (cartao_id, data_compra), que não
-- serve para os relatórios — eles varrem por casal + janela de datas.
create index if not exists compras_cartao_casal_data_idx
  on public.compras_cartao (casal_id, data_compra desc);

-- Relatório de compras parceladas filtra parcelas > 1.
create index if not exists compras_cartao_parceladas_idx
  on public.compras_cartao (casal_id, data_compra desc)
  where parcelas > 1;

-- Filtros "ativa/ativo = true", presentes em quase toda listagem.
create index if not exists contas_recorrentes_ativas_idx
  on public.contas_recorrentes (casal_id, quinzena, dia_vencimento)
  where ativa;

create index if not exists assinaturas_cartao_ativas_idx
  on public.assinaturas_cartao (casal_id, cartao_id)
  where ativa;

create index if not exists cartoes_ativos_idx
  on public.cartoes (casal_id)
  where ativo;

create index if not exists rendas_ativas_idx
  on public.rendas (casal_id, dia_recebimento)
  where ativa;

-- Busca global: 6 queries `ilike '%termo%'` por digitação. Sem trigram
-- isso é seq scan nas duas tabelas que mais crescem.
create extension if not exists pg_trgm;

create index if not exists lancamentos_descricao_trgm_idx
  on public.lancamentos using gin (descricao gin_trgm_ops);

create index if not exists compras_cartao_descricao_trgm_idx
  on public.compras_cartao using gin (descricao gin_trgm_ops);


-- ---------------------------------------------------------------------
-- 3. Integridade: FK não pode atravessar casais
-- ---------------------------------------------------------------------
-- A checagem de foreign key roda como dona da tabela e NÃO passa por RLS.
-- Então hoje dá para inserir uma linha com casal_id do próprio casal e
-- cartao_id (ou banco_id, divida_id...) de outro. Não vaza leitura, mas
-- quebra integridade e deixa ocupar o unique de pagamentos_fatura alheio.

create or replace function public.assert_mesmo_casal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_casal uuid;
  v_ref   uuid;
begin
  -- TG_ARGV[0] = tabela referenciada, TG_ARGV[1] = coluna FK nesta linha.
  execute format('select ($1).%I', TG_ARGV[1]) into v_ref using new;

  -- FK opcional em branco não tem o que validar.
  if v_ref is null then
    return new;
  end if;

  execute format('select casal_id from public.%I where id = $1', TG_ARGV[0])
    into v_casal using v_ref;

  if v_casal is distinct from new.casal_id then
    raise exception
      'registro referenciado em %.% pertence a outro casal',
      TG_ARGV[0], TG_ARGV[1]
      using errcode = '23514';
  end if;

  return new;
end $$;

drop trigger if exists compras_cartao_mesmo_casal on public.compras_cartao;
create trigger compras_cartao_mesmo_casal
  before insert or update on public.compras_cartao
  for each row execute function public.assert_mesmo_casal('cartoes', 'cartao_id');

drop trigger if exists assinaturas_cartao_mesmo_casal on public.assinaturas_cartao;
create trigger assinaturas_cartao_mesmo_casal
  before insert or update on public.assinaturas_cartao
  for each row execute function public.assert_mesmo_casal('cartoes', 'cartao_id');

drop trigger if exists pagamentos_fatura_mesmo_casal on public.pagamentos_fatura;
create trigger pagamentos_fatura_mesmo_casal
  before insert or update on public.pagamentos_fatura
  for each row execute function public.assert_mesmo_casal('cartoes', 'cartao_id');

drop trigger if exists cartoes_mesmo_casal on public.cartoes;
create trigger cartoes_mesmo_casal
  before insert or update on public.cartoes
  for each row execute function public.assert_mesmo_casal('bancos', 'banco_id');

drop trigger if exists pagamentos_divida_mesmo_casal on public.pagamentos_divida;
create trigger pagamentos_divida_mesmo_casal
  before insert or update on public.pagamentos_divida
  for each row execute function public.assert_mesmo_casal('dividas', 'divida_id');

drop trigger if exists lancamentos_mesmo_casal on public.lancamentos;
create trigger lancamentos_mesmo_casal
  before insert or update on public.lancamentos
  for each row execute function public.assert_mesmo_casal('contas_recorrentes', 'conta_recorrente_id');
