import { LogOutIcon } from "lucide-react";
import { signOut } from "@/lib/auth-actions";

type Props = {
  nomeCasal: string;
  nomeUsuario: string;
};

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function MobileHeader({ nomeCasal, nomeUsuario }: Props) {
  return (
    <header className="flex items-center justify-between px-5 py-4 md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-sage-300 font-heading text-sm text-sage-800">
          {iniciais(nomeUsuario) || "?"}
        </div>
        <div>
          <p className="font-heading text-base leading-none">Financeiro</p>
          <p className="text-xs text-muted-foreground">{nomeCasal}</p>
        </div>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          aria-label="Sair"
          className="rounded-full p-2 text-muted-foreground hover:bg-neutral-200 hover:text-foreground"
        >
          <LogOutIcon className="size-4" strokeWidth={2.75} />
        </button>
      </form>
    </header>
  );
}
