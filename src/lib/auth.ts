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

export async function requireSession(): Promise<SessionData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, papel, casal_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Usuário autenticado mas sem profile — problema no seed
    redirect("/login?error=" + encodeURIComponent("Profile não vinculado ao casal."));
  }

  const { data: casal } = await supabase
    .from("casais")
    .select("nome")
    .eq("id", profile.casal_id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? "",
    nome: profile.nome,
    papel: profile.papel as "titular" | "conjuge",
    casalId: profile.casal_id,
    casalNome: casal?.nome ?? "",
  };
}
