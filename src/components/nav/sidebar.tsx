"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { signOut } from "@/lib/auth-actions";
import { LinkPendingDot } from "./link-pending-dot";
import { ThemeToggle } from "./theme-toggle";

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
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:gap-6 md:bg-sidebar md:px-[18px] md:py-7 md:text-sidebar-foreground">
      <div className="px-2.5">
        <h1 className="font-heading text-[21px] leading-none">Financeiro</h1>
        <p className="mt-1 text-[13px] text-neutral-700">{nomeCasal}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return item.disabled ? (
            <span
              key={item.href}
              className="flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] text-muted-foreground/50"
              title="Em breve"
            >
              <Icon className="size-[18px]" strokeWidth={2.75} />
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
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-neutral-800 hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={2.75} />
              {item.label}
              <LinkPendingDot className="ml-auto" />
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 px-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-300 font-heading text-sm text-sage-800">
          {iniciais(nomeUsuario) || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{nomeUsuario}</p>
          <p className="truncate text-xs text-neutral-700">{emailUsuario}</p>
        </div>
        <ThemeToggle />
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sair"
            className="rounded-full p-2 text-neutral-700 hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOutIcon className="size-4" strokeWidth={2.75} />
          </button>
        </form>
      </div>
    </aside>
  );
}
