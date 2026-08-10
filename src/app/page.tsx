import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signOut } from "./actions";

export default async function HomePage() {
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

  const { data: casal } = profile
    ? await supabase
        .from("casais")
        .select("nome")
        .eq("id", profile.casal_id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Financeiro do Casal
          </h1>
          <p className="text-sm text-muted-foreground">
            {profile?.nome
              ? `Olá, ${profile.nome} — ${user.email}`
              : user.email}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo!</CardTitle>
          <CardDescription>
            O sistema está no ar. As próximas fases (rendas, contas
            recorrentes, dashboard, despesas) serão adicionadas em seguida.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {profile ? (
            <p>
              Casal: <strong>{casal?.nome ?? "—"}</strong> · Papel:{" "}
              {profile.papel}
            </p>
          ) : (
            <p>
              Nenhum profile encontrado para este usuário. Rode o script{" "}
              <code>supabase/seed_casal.sql</code> para vincular o casal.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
