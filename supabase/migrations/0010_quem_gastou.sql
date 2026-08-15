-- =====================================================================
-- Quem gastou — atribuição explícita de despesa/conta/assinatura
-- =====================================================================
-- Até aqui o relatório "gastos por pessoa" inferia de quem era o gasto
-- pelo criado_por/criada_por (quem cadastrou o lançamento) — mas quem
-- cadastra nem sempre é de quem é o gasto (ex: Bruno lança uma despesa
-- da Jacqueline, ou uma conta é do casal, não de um dos dois).
--
-- `quem_gastou` guarda explicitamente: o uuid de um dos dois profiles
-- do casal, ou o literal 'casal' quando o gasto é compartilhado. Fica
-- null pra lançamentos antigos (o relatório trata null como "não
-- especificado") — sem backfill automático, por pedido do usuário.
--
-- Não é uma FK pra profiles porque 'casal' não é um profile real —
-- validação de que o uuid pertence ao casal certo fica na aplicação
-- (mesmo approach de `categoria`/`categoria_id`: texto solto,
-- resolvido/validado no server action).
-- =====================================================================

alter table public.lancamentos
  add column if not exists quem_gastou text;

alter table public.contas_recorrentes
  add column if not exists quem_gastou text;

alter table public.compras_cartao
  add column if not exists quem_gastou text;

alter table public.assinaturas_cartao
  add column if not exists quem_gastou text;

create index if not exists lancamentos_quem_gastou_idx        on public.lancamentos(quem_gastou);
create index if not exists contas_recorrentes_quem_gastou_idx on public.contas_recorrentes(quem_gastou);
create index if not exists compras_cartao_quem_gastou_idx     on public.compras_cartao(quem_gastou);
create index if not exists assinaturas_cartao_quem_gastou_idx on public.assinaturas_cartao(quem_gastou);
