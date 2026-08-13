import Link from "next/link";
import { LogOutIcon, TagIcon, BarChart3Icon } from "lucide-react";
import { signOut } from "@/lib/auth-actions";
import { ThemeToggle } from "./theme-toggle";

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
    <header className="flex items-center justify-between px-5 pt-6 pb-2 md:hidden">
      <div className="min-w-0">
        <p className="font-heading text-[20px] leading-none">Financeiro</p>
        <p className="mt-1 truncate text-[13px] text-neutral-700">
          {nomeCasal}
        </p>
      </div>
      <div className="flex items-center">
        <Link
          href="/relatorios"
          aria-label="Relatórios"
          className="flex size-11 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-200 hover:text-foreground"
        >
          <BarChart3Icon className="size-[18px]" strokeWidth={2.75} />
        </Link>
        <Link
          href="/categorias"
          aria-label="Categorias"
          className="flex size-11 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-200 hover:text-foreground"
        >
          <TagIcon className="size-[18px]" strokeWidth={2.75} />
        </Link>
        <ThemeToggle className="size-11 justify-center p-0" />
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sair"
            className="flex size-11 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-200 hover:text-foreground"
          >
            <LogOutIcon className="size-[18px]" strokeWidth={2.75} />
          </button>
        </form>
        <div className="ml-1 flex size-10 items-center justify-center rounded-full bg-sage-300 font-heading text-[15px] text-sage-800">
          {iniciais(nomeUsuario) || "?"}
        </div>
      </div>
    </header>
  );
}
