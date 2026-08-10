-- =====================================================================
-- Seed manual do casal
-- =====================================================================
-- IMPORTANTE: rode este SQL SOMENTE DEPOIS de criar os 2 usuários no
-- Authentication → Users do painel Supabase.
--
-- Passos:
--   1. No painel Supabase: Authentication → Providers → Email → desabilitar
--      "Enable Sign Ups" (só vocês dois vão existir).
--   2. Authentication → Users → Add user (Create new user):
--        - Email: bruno@exemplo.com  (troque pelo seu)
--        - Password: (defina)
--        - Auto Confirm User: SIM
--   3. Repita para o email da esposa.
--   4. Substitua os placeholders abaixo pelos emails reais e rode.
--   5. Depois de rodar, valide com:
--        select p.nome, p.papel, c.nome as casal
--        from profiles p join casais c on c.id = p.casal_id;
--      Devem aparecer 2 linhas com o MESMO casal.
-- =====================================================================

do $$
declare
  v_casal_id       uuid;
  v_titular_id     uuid;
  v_conjuge_id     uuid;
  v_email_titular  text := 'bruno.manuel99@hotmail.com';   -- ⚠️ TROQUE
  v_email_conjuge  text := 'js3011@hotmail.com';   -- ⚠️ TROQUE
  v_nome_titular   text := 'Bruno';                  -- ⚠️ TROQUE
  v_nome_conjuge   text := 'Jacqueline';                 -- ⚠️ TROQUE
  v_nome_casal     text := 'Bruno & Jacqueline';         -- ⚠️ TROQUE
begin
  select id into v_titular_id from auth.users where email = v_email_titular;
  select id into v_conjuge_id from auth.users where email = v_email_conjuge;

  if v_titular_id is null then
    raise exception 'Usuário titular não encontrado: %', v_email_titular;
  end if;
  if v_conjuge_id is null then
    raise exception 'Usuário cônjuge não encontrado: %', v_email_conjuge;
  end if;

  insert into public.casais (nome) values (v_nome_casal) returning id into v_casal_id;

  insert into public.profiles (id, casal_id, nome, papel)
  values
    (v_titular_id, v_casal_id, v_nome_titular, 'titular'),
    (v_conjuge_id, v_casal_id, v_nome_conjuge, 'conjuge');

  raise notice 'Casal criado: % (id=%)', v_nome_casal, v_casal_id;
end $$;
