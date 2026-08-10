import { redirect } from "next/navigation";
import { WalletIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <div className="flex flex-col gap-5 p-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <WalletIcon className="size-6" strokeWidth={2.75} />
          </div>
          <div className="text-center">
            <h1 className="font-heading text-2xl leading-tight">
              Nosso financeiro
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre para ver quanto sobra nesta quinzena.
            </p>
          </div>

          <form action={signIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="password"
                className="text-xs text-muted-foreground"
              >
                Senha
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p className="text-center text-sm text-primary" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
