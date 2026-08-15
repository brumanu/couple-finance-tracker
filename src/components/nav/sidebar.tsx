"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOutIcon,
  SearchIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { signOut } from "@/lib/auth-actions";
import { LinkPendingDot } from "./link-pending-dot";
import { ThemeToggle } from "./theme-toggle";
import { useSearch } from "@/components/search/search-provider";
import { PushToggleButton } from "@/components/push/push-toggle-button";
import { useSidebar } from "./sidebar-provider";

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
  const { setOpen: setSearchOpen } = useSearch();
  const { mobileOpen, setMobileOpen, collapsed, toggleCollapsed } =
    useSidebar();

  // No mobile o rail não existe: o drawer sempre abre por extenso.
  const railDesktop = collapsed;

  return (
    <>
      {/* Backdrop do drawer — só mobile, some junto com o menu. */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden
        className={cn(
          // z acima do bottom-nav e do FAB (ambos z-40), abaixo do drawer.
          "fixed inset-0 z-[45] bg-[color-mix(in_srgb,var(--organic-neutral-900)_45%,transparent)] transition-opacity duration-200 md:hidden",
          mobileOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          // Mobile: painel fixo que desliza da esquerda.
          "fixed inset-y-0 left-0 z-50 flex w-[17rem] shrink-0 flex-col gap-6 overflow-y-auto bg-sidebar px-[18px] py-7 text-sidebar-foreground transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: fica grudado no topo da viewport enquanto o conteúdo
          // principal rola, com a largura animando entre rail e expandido.
          "md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 md:transition-[width] md:duration-200",
          railDesktop ? "md:w-[76px] md:px-3" : "md:w-64",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            railDesktop ? "md:justify-center md:px-0" : "px-2.5",
          )}
        >
          <div className={cn("min-w-0 flex-1", railDesktop && "md:hidden")}>
            <h1 className="font-heading text-[21px] leading-none">
              Financeiro
            </h1>
            <p className="mt-1 truncate text-[13px] text-neutral-700">
              {nomeCasal}
            </p>
          </div>

          {/* Recolher/expandir: só desktop. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={railDesktop ? "Expandir menu" : "Recolher menu"}
            title={railDesktop ? "Expandir menu" : "Recolher menu"}
            className="hidden shrink-0 rounded-full p-2 text-neutral-700 transition-colors hover:bg-sidebar-accent hover:text-foreground md:inline-flex"
          >
            {railDesktop ? (
              <PanelLeftOpenIcon className="size-[18px]" strokeWidth={2.75} />
            ) : (
              <PanelLeftCloseIcon className="size-[18px]" strokeWidth={2.75} />
            )}
          </button>

          {/* Fechar o drawer: só mobile. */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="shrink-0 rounded-full p-2 text-neutral-700 transition-colors hover:bg-sidebar-accent hover:text-foreground md:hidden"
          >
            <XIcon className="size-[18px]" strokeWidth={2.75} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            setSearchOpen(true);
          }}
          title="Buscar"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-full bg-sidebar-accent/50 py-2.5 text-[14px] text-neutral-700 transition-colors hover:bg-sidebar-accent hover:text-foreground",
            railDesktop ? "md:justify-center md:px-0" : "px-4",
          )}
        >
          <SearchIcon className="size-[16px] shrink-0" strokeWidth={2.75} />
          <span
            className={cn("flex-1 text-left", railDesktop && "md:hidden")}
          >
            Buscar
          </span>
          <span
            className={cn(
              "shrink-0 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground",
              railDesktop && "md:hidden",
            )}
          >
            ⌘K
          </span>
        </button>

        <nav className="flex flex-1 flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            const base = cn(
              "flex items-center gap-3 rounded-full py-2.5 text-[15px] transition-colors",
              railDesktop ? "md:justify-center md:px-0" : "px-4",
            );
            return item.disabled ? (
              <span
                key={item.href}
                className={cn(base, "text-muted-foreground/50")}
                title="Em breve"
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={2.75} />
                <span className={cn(railDesktop && "md:hidden")}>
                  {item.label}
                </span>
                <span
                  className={cn(
                    "ml-auto text-[10px] uppercase tracking-wide",
                    railDesktop && "md:hidden",
                  )}
                >
                  em breve
                </span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  base,
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-neutral-800 hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={2.75} />
                <span className={cn(railDesktop && "md:hidden")}>
                  {item.label}
                </span>
                <LinkPendingDot
                  className={cn("ml-auto", railDesktop && "md:hidden")}
                />
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "flex items-center gap-2.5",
            railDesktop ? "md:flex-col md:gap-1 md:px-0" : "px-2",
          )}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-300 font-heading text-sm text-sage-800">
            {iniciais(nomeUsuario) || "?"}
          </div>
          <div className={cn("min-w-0 flex-1", railDesktop && "md:hidden")}>
            <p className="truncate text-[13px] font-semibold">{nomeUsuario}</p>
            <p className="truncate text-xs text-neutral-700">{emailUsuario}</p>
          </div>
          <PushToggleButton />
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sair"
              title="Sair"
              className="rounded-full p-2 text-neutral-700 hover:bg-sidebar-accent hover:text-foreground"
            >
              <LogOutIcon className="size-4" strokeWidth={2.75} />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
