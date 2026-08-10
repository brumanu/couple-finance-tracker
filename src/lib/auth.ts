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
export const requireSession = cache(async (): Promise<SessionData> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1 query só combinando profile + casal (evita 2 round-trips).
  // Retorna { casais: { nome } } porque profiles.casal_id é FK para casais.
  const { data } = await supabase
    .from("profiles")
    .select("nome, papel, casal_id, casais(nome)")
    .eq("id", user.id)
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
    userId: user.id,
    email: user.email ?? "",
    nome: data.nome,
    papel: data.papel as "titular" | "conjuge",
    casalId: data.casal_id,
    casalNome: data.casais?.nome ?? "",
  };
});
