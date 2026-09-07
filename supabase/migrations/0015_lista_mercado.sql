-- =====================================================================
-- Lista de compras de mercado
-- =====================================================================
-- Duas tabelas e uma função. O que separa esta feature das outras do app
-- é onde ela é usada: em pé, dentro do mercado, com uma mão só e sinal
-- ruim. Isso explica três decisões que de outro modo pareceriam estranhas.
--
-- 1. `listas_mercado` tem um índice único parcial garantindo NO MÁXIMO UMA
--    lista aberta por casal. É o que permite a rota /mercado resolver
--    sozinha qual lista mostrar — sem seletor, sem decisão no corredor. E
--    impede que os dois celulares criem duas listas ao mesmo tempo.
--
-- 2. `itens_lista_mercado.status` tem três valores, não um booleano:
--    `pendente` (nem olhei), `carrinho` (achei e peguei) e
--    `nao_encontrado` (procurei e não tinha). O terceiro estado é o que
--    alimenta o "leva pra próxima ida" no fechamento.
--
-- 3. `finalizar_lista_mercado()` faz quatro escritas numa transação só.
--    Se a despesa entrasse e a lista não fechasse, a segunda tentativa
--    lançaria a despesa de novo. É a única operação do app onde falhar
--    pela metade custa dinheiro errado no relatório.
--
-- Idempotente: pode rodar inteiro no SQL Editor mais de uma vez.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. listas_mercado — uma ida ao mercado
-- ---------------------------------------------------------------------

create table if not exists public.listas_mercado (
  id               uuid primary key default gen_random_uuid(),
  casal_id         uuid not null default public.current_casal_id()
                     references public.casais(id) on delete cascade,
  status           text not null default 'aberta'
                     check (status in ('aberta', 'finalizada')),
  finalizada_em    date,
  total            numeric(12,2) check (total >= 0),
  -- A despesa gerada mora em `lancamentos` (pagou no débito/dinheiro) OU em
  -- `compras_cartao` (pagou no cartão). Nunca nas duas — ver o check abaixo.
  lancamento_id    uuid references public.lancamentos(id)    on delete set null,
  compra_cartao_id uuid references public.compras_cartao(id) on delete set null,
  criado_por       uuid default auth.uid()
                     references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),

  -- Lista fechada tem data e total; lista aberta não tem nem um nem outro.
  -- Sem isto, um update parcial deixaria a linha num estado que nenhuma tela
  -- sabe renderizar.
  constraint listas_mercado_fechamento_coerente check (
    (status = 'aberta'     and finalizada_em is null     and total is null) or
    (status = 'finalizada' and finalizada_em is not null and total is not null)
  ),

  constraint listas_mercado_uma_despesa check (
    lancamento_id is null or compra_cartao_id is null
  )
);

-- O índice que sustenta a UX inteira: /mercado nunca precisa perguntar
-- "qual lista?" porque só pode existir uma aberta.
create unique index if not exists listas_mercado_uma_aberta_idx
  on public.listas_mercado (casal_id)
  where status = 'aberta';

create index if not exists listas_mercado_historico_idx
  on public.listas_mercado (casal_id, finalizada_em desc)
  where status = 'finalizada';


-- ---------------------------------------------------------------------
-- 2. itens_lista_mercado
-- ---------------------------------------------------------------------

create table if not exists public.itens_lista_mercado (
  id            uuid primary key default gen_random_uuid(),
  casal_id      uuid not null default public.current_casal_id()
                  references public.casais(id) on delete cascade,
  lista_id      uuid not null references public.listas_mercado(id) on delete cascade,
  nome          text not null check (length(trim(nome)) > 0),
  -- Texto livre ("5kg", "2x", "1 pacote"): separar número de unidade seria
  -- burocracia num campo que ninguém soma.
  quantidade    text,
  preco         numeric(12,2) check (preco >= 0),
  status        text not null default 'pendente'
                  check (status in ('pendente', 'carrinho', 'nao_encontrado')),
  -- Veio da lista anterior por não ter sido encontrado. Só serve pra tela
  -- mostrar o selinho "faltou da última vez".
  faltou_antes  boolean not null default false,
  ordem         int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists itens_lista_mercado_lista_idx
  on public.itens_lista_mercado (lista_id, ordem);

-- Autocomplete do campo de adicionar item: agrega nomes já usados pelo casal.
create index if not exists itens_lista_mercado_nome_idx
  on public.itens_lista_mercado (casal_id, nome);


-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
-- Mesmo formato da 0013: `to authenticated` e `(select ...)` pra que a
-- função de escopo vire InitPlan e rode uma vez por query, não por linha.

alter table public.listas_mercado      enable row level security;
alter table public.itens_lista_mercado enable row level security;

drop policy if exists "listas_mercado_scope" on public.listas_mercado;
create policy "listas_mercado_scope" on public.listas_mercado
  for all to authenticated
  using      (casal_id = (select public.current_casal_id()))
  with check (casal_id = (select public.current_casal_id()));

drop policy if exists "itens_lista_mercado_scope" on public.itens_lista_mercado;
create policy "itens_lista_mercado_scope" on public.itens_lista_mercado
  for all to authenticated
  using      (casal_id = (select public.current_casal_id()))
  with check (casal_id = (select public.current_casal_id()));


-- ---------------------------------------------------------------------
-- 4. Integridade: FK não atravessa casal
-- ---------------------------------------------------------------------
-- A checagem de foreign key roda como dona da tabela e NÃO passa por RLS.
-- Sem estas triggers dá pra inserir um item com casal_id próprio apontando
-- pra lista de outro casal. Mesma função da 0013.

drop trigger if exists itens_lista_mercado_mesmo_casal on public.itens_lista_mercado;
create trigger itens_lista_mercado_mesmo_casal
  before insert or update on public.itens_lista_mercado
  for each row execute function public.assert_mesmo_casal('listas_mercado', 'lista_id');

drop trigger if exists listas_mercado_mesmo_casal_lancamento on public.listas_mercado;
create trigger listas_mercado_mesmo_casal_lancamento
  before insert or update on public.listas_mercado
  for each row execute function public.assert_mesmo_casal('lancamentos', 'lancamento_id');

drop trigger if exists listas_mercado_mesmo_casal_compra on public.listas_mercado;
create trigger listas_mercado_mesmo_casal_compra
  before insert or update on public.listas_mercado
  for each row execute function public.assert_mesmo_casal('compras_cartao', 'compra_cartao_id');


-- ---------------------------------------------------------------------
-- 5. finalizar_lista_mercado()
-- ---------------------------------------------------------------------
-- Quatro escritas que não podem falhar pela metade:
--   1. confere que a lista está aberta (toque duplo, duas abas);
--   2. cria a despesa — em `lancamentos` ou em `compras_cartao`;
--   3. fecha a lista apontando pra despesa criada;
--   4. abre a próxima lista e copia pra ela os itens que o usuário mandou
--      manter, marcados com `faltou_antes`.
--
-- A ordem de 3 e 4 não é negociável: o índice único parcial só admite uma
-- lista aberta, então a nova só cabe depois que a atual fecha.
--
-- `security invoker` (o padrão do plpgsql, explicitado aqui de propósito):
-- a função roda com as permissões de quem chama, então RLS continua valendo
-- normalmente e nenhum casal enxerga o outro.

create or replace function public.finalizar_lista_mercado(
  p_lista_id     uuid,
  p_total        numeric,
  p_data         date,
  p_cartao_id    uuid,      -- null = despesa avulsa (débito/dinheiro/pix)
  p_quinzena     smallint,  -- usado só quando p_cartao_id is null
  p_categoria_id uuid,
  p_categoria    text,      -- nome da categoria (coluna text legada)
  p_quem_gastou  text,      -- uuid de profile ou o literal 'casal'
  p_descricao    text,
  p_manter       uuid[]     -- ids dos itens que vão pra próxima lista
) returns uuid               -- id da lista nova
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_status        text;
  v_lancamento_id uuid;
  v_compra_id     uuid;
  v_nova_lista    uuid;
begin
  -- 1. Trava a linha e confere o estado. Dois "Finalizar" simultâneos: o
  --    segundo espera aqui e sai pelo raise.
  select status into v_status
    from public.listas_mercado
   where id = p_lista_id
     for update;

  if v_status is null then
    raise exception 'Lista não encontrada.' using errcode = 'P0002';
  end if;

  if v_status <> 'aberta' then
    raise exception 'Esta compra já foi finalizada.' using errcode = 'P0001';
  end if;

  if p_total is null or p_total <= 0 then
    raise exception 'Informe quanto deu a compra.' using errcode = 'P0001';
  end if;

  -- 2. A despesa. `casal_id` e `criado_por` saem dos defaults da 0014.
  if p_cartao_id is not null then
    insert into public.compras_cartao (
      cartao_id, descricao, valor_total, data_compra,
      parcelas, parcelas_ja_pagas, categoria, categoria_id, quem_gastou
    ) values (
      p_cartao_id, p_descricao, p_total, p_data,
      1, 0, p_categoria, p_categoria_id, p_quem_gastou
    )
    returning id into v_compra_id;
  else
    insert into public.lancamentos (
      tipo, descricao, valor, data_pagamento, data_referencia,
      quinzena, categoria, categoria_id, quem_gastou
    ) values (
      'despesa_avulsa', p_descricao, p_total, p_data,
      date_trunc('month', p_data::timestamp)::date,
      p_quinzena, p_categoria, p_categoria_id, p_quem_gastou
    )
    returning id into v_lancamento_id;
  end if;

  -- 3. Fecha a lista.
  update public.listas_mercado
     set status           = 'finalizada',
         finalizada_em    = p_data,
         total            = p_total,
         lancamento_id    = v_lancamento_id,
         compra_cartao_id = v_compra_id
   where id = p_lista_id;

  -- 4. Abre a próxima e leva o que sobrou. `preco` não é copiado: o preço
  --    era daquela compra, não deste item pra sempre.
  insert into public.listas_mercado default values
  returning id into v_nova_lista;

  insert into public.itens_lista_mercado (
    lista_id, nome, quantidade, status, faltou_antes, ordem
  )
  select
    v_nova_lista, i.nome, i.quantidade, 'pendente', true,
    row_number() over (order by i.ordem, i.created_at)
  from public.itens_lista_mercado i
  where i.lista_id = p_lista_id
    and i.id = any(p_manter);

  return v_nova_lista;
end
$fn$;

-- A função de fechamento não precisa ficar exposta ao papel anon.
revoke execute on function public.finalizar_lista_mercado(
  uuid, numeric, date, uuid, smallint, uuid, text, text, text, uuid[]
) from public, anon;

grant execute on function public.finalizar_lista_mercado(
  uuid, numeric, date, uuid, smallint, uuid, text, text, text, uuid[]
) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Conferência
-- ---------------------------------------------------------------------
-- Depois de rodar, isto deve devolver 2 linhas com rowsecurity = true:
--
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public'
--     and tablename in ('listas_mercado', 'itens_lista_mercado');
--
-- E isto deve devolver 1 linha:
--
--   select proname from pg_proc where proname = 'finalizar_lista_mercado';
