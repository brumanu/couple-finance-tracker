-- =====================================================================
-- Defaults de escopo — Fase 3 da revisão de setembro/2026
-- =====================================================================
-- `casal_id` e `criado_por` passam a ter default no banco.
--
-- Motivo: toda action de cadastro fazia
--
--   auth.getUser()                       -- round-trip pro Auth server
--   profiles.select("casal_id")          -- ida ao banco
--   insert({ casal_id: profile.casal_id, ... })
--
-- só pra descobrir um valor que o próprio Postgres já sabe calcular. Com o
-- default, o insert omite a coluna e o banco preenche. São 13 arquivos de
-- action com uma ida ao banco a menos por cadastro.
--
-- Isso NÃO afrouxa nada:
--   - as colunas continuam `not null`;
--   - o `with check (casal_id = current_casal_id())` da RLS continua sendo
--     avaliado depois do default, então um cliente que MANDE um casal_id de
--     outro casal segue sendo rejeitado — exatamente como antes;
--   - a trigger `assert_mesmo_casal()` da 0013 continua valendo pras FKs.
--
-- O default só se aplica quando a coluna é omitida no insert, então nenhum
-- código existente muda de comportamento. Idempotente e sem rewrite de tabela
-- (`set default` só mexe no catálogo).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. casal_id
-- ---------------------------------------------------------------------
-- `current_casal_id()` é stable + security definer e já tem execute pro papel
-- authenticated (concedido na 0013). Como default de coluna ela roda como o
-- usuário que insere, então esse grant é o suficiente.
--
-- `profiles` fica de fora de propósito: ela nasce no cadastro, quando o
-- usuário ainda não tem casal, e é justamente a tabela que a função lê.

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
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format(
      'alter table public.%I alter column casal_id set default public.current_casal_id()',
      t
    );
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 2. criado_por / criada_por
-- ---------------------------------------------------------------------
-- Seis tabelas guardam quem cadastrou. O valor sempre foi `user.id`, que é
-- exatamente o que `auth.uid()` devolve. A coluna é nullable e tem
-- `on delete set null`, então o default não muda nenhuma garantia.
--
-- Atenção: em conexões com a service role `auth.uid()` é null. Nenhuma
-- rotina de service role insere nestas tabelas hoje (o cron só lê e apaga
-- push_subscriptions mortas), e se um dia inserir, a coluna aceita null.

-- Atenção ao nome da coluna: cinco tabelas usam `criado_por`, mas
-- `assinaturas_cartao` usa `criada_por` (assinatura é feminino). São seis
-- colunas, não cinco — por isso o array leva o par tabela/coluna.

do $$
declare
  par text[];
  pares text[][] := array[
    array['lancamentos',        'criado_por'],
    array['compras_cartao',     'criado_por'],
    array['pagamentos_divida',  'criado_por'],
    array['pagamentos_fatura',  'criado_por'],
    array['compras_futuras',    'criado_por'],
    array['assinaturas_cartao', 'criada_por']
  ];
begin
  foreach par slice 1 in array pares loop
    if to_regclass('public.' || par[1]) is null then
      continue;
    end if;
    execute format(
      'alter table public.%I alter column %I set default auth.uid()',
      par[1], par[2]
    );
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 3. Conferência
-- ---------------------------------------------------------------------
-- Depois de rodar, isto deve listar 13 linhas de casal_id e 6 de autoria,
-- todas com um default preenchido:
--
--   select table_name, column_name, column_default
--   from information_schema.columns
--   where table_schema = 'public'
--     and column_name in ('casal_id', 'criado_por', 'criada_por')
--     and column_default is not null
--   order by column_name, table_name;
