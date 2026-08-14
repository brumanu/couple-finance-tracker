import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionData = {
  userId: string;
  email: string;
  nome: string;
  papel: "titular" | "conjuge";
  casalId: string;
  casalNome: string;
};

// React.cache memoiza por request: mesmo se chamado no layout E na page,
// executa uma vez só. Fundamental pra evitar 3 chamadas Supabase por nav.
//
// Usa getClaims() em vez de getUser(): o JWT é verificado localmente contra
// o JWKS (cacheado em memória), sem round-trip pro Auth server a cada nav —
// mesma estratégia já usada em lib/supabase/middleware.ts.
export const requireSession = cache(async (): Promise<SessionData> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData) {
    redirect("/login");
  }

  const userId = claimsData.claims.sub;
  const email = (claimsData.claims.email as string | undefined) ?? "";

  // 1 query só combinando profile + casal (evita 2 round-trips).
  // Retorna { casais: { nome } } porque profiles.casal_id é FK para casais.
  const { data } = await supabase
    .from("profiles")
    .select("nome, papel, casal_id, casais(nome)")
    .eq("id", userId)
    .maybeSingle<{
      nome: string;
      papel: string;
      casal_id: string;
      casais: { nome: string } | null;
    }>();

  if (!data) {
    redirect(
      "/login?error=" +
        encodeURIComponent("Profile não vinculado ao casal."),
    );
  }

  return {
    userId,
    email,
    nome: data.nome,
    papel: data.papel as "titular" | "conjuge",
    casalId: data.casal_id,
    casalNome: data.casais?.nome ?? "",
  };
});
