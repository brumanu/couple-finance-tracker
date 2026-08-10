# Financeiro do Casal

Sistema web privado de controle financeiro quinzenal.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Supabase** (Postgres + RLS + Auth) — cliente `@supabase/ssr`
- **Vercel** (hospedagem) + **GitHub Actions** (cron semanal para keepalive do Supabase)

## Rodando localmente

```bash
cp .env.local.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

## Configuração do Supabase (primeira vez)

1. Crie um projeto em https://supabase.com (free tier).
2. Rode a migration `supabase/migrations/0001_schema.sql` no SQL Editor.
3. Em Authentication → Providers → Email, **desative** "Enable Sign Ups".
4. Em Authentication → Users, crie os 2 usuários (email + senha, Auto Confirm).
5. Ajuste os placeholders em `supabase/seed_casal.sql` e rode.
6. Copie URL e anon key para `.env.local`.

## Estrutura

- `src/app/` — páginas (App Router) e Server Actions
- `src/lib/supabase/` — clients server/browser + middleware de sessão
- `src/proxy.ts` — proxy do Next 16 (renomeado de `middleware.ts`)
- `supabase/migrations/` — schema versionado
- `.github/workflows/keepalive.yml` — cron semanal contra pausa do Supabase free
