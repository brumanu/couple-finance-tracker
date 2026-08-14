import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase com service role key — BYPASSA RLS.
 *
 * Uso restrito a rotas sem sessão de usuário (ex: cron de lembretes).
 * REGRA CRÍTICA: como não tem RLS, toda query feita com este client
 * precisa filtrar `.eq("casal_id", casalId)` manualmente, sem exceção,
 * senão vaza dado de um casal pro outro.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
