-- =====================================================================
-- Bancos: adicionar 'inter' à lista de ícones permitidos
-- =====================================================================

alter table public.bancos
  drop constraint if exists bancos_icone_check;

alter table public.bancos
  add constraint bancos_icone_check
  check (
    icone is null
    or icone in ('nubank','itau','picpay','mercadopago','c6','inter')
  );
