"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { signOut } from "@/lib/auth-actions";

type Props = {
  nomeUsuario: string;
  emailUsuario: string;
  nomeCasal: string;
};

export function Sidebar({ nomeUsuario, emailUsuario, nomeCasal }: Props) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-card">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold tracking-tight">Financeiro</h1>
        <p className="text-xs text-muted-foreground">{nomeCasal}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return item.disabled ? (
            <span
              key={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50"
              title="Em breve"
            >
              <Icon className="size-4" />
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
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 px-1 text-xs">
          <p className="font-medium">{nomeUsuario}</p>
          <p className="truncate text-muted-foreground">{emailUsuario}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOutIcon className="size-4" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
