import { LogOutIcon } from "lucide-react";
import { signOut } from "@/lib/auth-actions";

type Props = {
  nomeCasal: string;
  nomeUsuario: string;
};

export function MobileHeader({ nomeCasal, nomeUsuario }: Props) {
  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
      <div>
        <h1 className="text-base font-semibold leading-tight">Financeiro</h1>
        <p className="text-xs text-muted-foreground">
          {nomeCasal} · {nomeUsuario}
        </p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          aria-label="Sair"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOutIcon className="size-4" />
        </button>
      </form>
    </header>
  );
}
