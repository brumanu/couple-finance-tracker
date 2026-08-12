import { redirect } from "next/navigation";
import { ShieldIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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
      <div className="w-full max-w-[430px]">
        <div className="flex flex-col gap-6 rounded-[32px] bg-card px-8 py-9 shadow-organic-lg">
          <div>
            <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ShieldIcon className="size-6" strokeWidth={2.75} />
            </div>
            <h1 className="mt-5 font-heading text-[30px] leading-tight">
              Nosso financeiro
            </h1>
            <p className="mt-2 text-[15px] text-neutral-700">
              Entre para ver quanto sobra nesta quinzena.
            </p>
          </div>

          <form action={signIn} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-xs text-neutral-700">
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
              <Label htmlFor="password" className="text-xs text-neutral-700">
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
            <Button type="submit" size="lg" className="w-full">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
