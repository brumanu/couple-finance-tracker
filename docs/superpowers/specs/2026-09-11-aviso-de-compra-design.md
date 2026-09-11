# Aviso de compra pro outro — desenho

Data: 11/09/2026 · Aprovado pelo usuário em chat antes da implementação.

## Problema

O app só manda push de vencimento (cron diário). Quando um dos dois lança
uma compra, o outro só fica sabendo se abrir o app.

## Escopo

- Avisa ao **cadastrar** uma compra no cartão (tela do cartão, ou cadastro
  de despesa com cartão escolhido) ou uma despesa avulsa.
- Não avisa: edição, exclusão, finalizar o Mercado, "Quero comprar" →
  Comprei, pagamento de conta fixa ou de fatura, renda extra.
- Toda compra, na hora. Sem valor mínimo nem resumo.
- Um sino só: quem ativou recebe vencimentos e compras. Separar por tipo
  exigiria coluna nova e menu; fica pra depois se incomodar.

## O aviso

- Título: `<nome de quem lançou> lançou` (nome de `profiles.nome`).
- Corpo: `<descrição> — <valor total>`, por exemplo "Farmácia — R$ 89,90".
  Compra parcelada mostra o total, sem cartão nem parcelas.
- Toque: `/cartoes/<id>` se foi no cartão; `/despesas` se foi avulsa.
- Destinatários: todas as `push_subscriptions` do casal **menos as de quem
  lançou** (`profile_id <> auth.uid()`).

## Como funciona

1. `createCompra` (`src/app/(app)/cartoes/[id]/actions.ts`) e
   `createDespesa` (`src/app/(app)/despesas/actions.ts`), depois de gravar
   com sucesso (incluindo as categorias extras), chamam
   `after(() => avisarCompra(...))`.
2. `after()` (next/server) roda depois da resposta: a tela não espera o
   envio. Na Vercel ele usa `waitUntil`, então a função continua viva até o
   envio terminar.
3. `avisarCompra` (`src/lib/push/aviso-compra-server.ts`) usa o mesmo
   cliente Supabase da sessão — a RLS de `push_subscriptions` já deixa ler
   as inscrições do casal. Busca o nome de quem lançou e as inscrições dos
   outros, monta o aviso e envia. O texto e a escolha dos destinatários são
   funções puras em `src/lib/push/aviso-compra.ts` (separadas porque o
   arquivo `-server` importa `server-only`, que não carrega nos testes).
4. O envio em si (`src/lib/push/enviar.ts`) sai de dentro da rota do cron e
   passa a ser compartilhado: configura o VAPID, manda o payload pra cada
   inscrição e devolve os ids que responderam 404/410 (aparelho que não
   existe mais), pra quem chamou apagar.

Nenhuma migration, nenhuma mudança de tela.

## Falhas

- Sem as chaves VAPID (caso do `.env.local`), `avisarCompra` não envia e não
  quebra nada.
- Erro de envio ou de consulta vai pro log (`console.error`) e não afeta o
  cadastro, que já respondeu.
- Inscrição que respondeu 404/410 é apagada, como o cron já faz.

## Testes

- `src/lib/push/aviso-compra.test.ts`: texto do aviso (título, corpo com
  valor formatado, destino por tipo) e escolha dos destinatários (quem
  lançou fica de fora, casal sem outro aparelho não envia).
- Verificação real só em produção: as chaves VAPID da Vercel são do tipo
  Secret e não existem no ambiente local. Depois do deploy, com o sino
  ativo no aparelho de um, o outro lança uma compra; conferir a chegada e o
  log da Vercel.
