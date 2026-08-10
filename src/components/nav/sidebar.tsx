"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { signOut } from "@/lib/auth-actions";
import { LinkPendingDot } from "./link-pending-dot";

type Props = {
  nomeUsuario: string;
  emailUsuario: string;
  nomeCasal: string;
};

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({ nomeUsuario, emailUsuario, nomeCasal }: Props) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:bg-sidebar md:text-sidebar-foreground">
      <div className="px-6 pt-8 pb-6">
        <h1 className="font-heading text-2xl leading-none">Financeiro</h1>
        <p className="mt-2 text-xs text-muted-foreground">{nomeCasal}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return item.disabled ? (
            <span
              key={item.href}
              className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm text-muted-foreground/50"
              title="Em breve"
            >
              <Icon className="size-4" strokeWidth={2.75} />
              {item.label}
              <span className="ml-auto text-[10px] uppercase tracking-wide">
                em breve
              </span>
            </span>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={2.75} />
              {item.label}
              <LinkPendingDot className="ml-auto" />
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-6 mt-4 flex items-center gap-3 rounded-full px-2 py-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-300 font-heading text-sm text-sage-800">
          {iniciais(nomeUsuario) || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{nomeUsuario}</p>
          <p className="truncate text-xs text-muted-foreground">
            {emailUsuario}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sair"
            className="rounded-full p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOutIcon className="size-4" strokeWidth={2.75} />
          </button>
        </form>
      </div>
    </aside>
  );
}
