"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavItemAtivo } from "./nav-items";
import { LinkPendingDot } from "./link-pending-dot";
import { useSidebar } from "./sidebar-provider";

const ITENS_BARRA = NAV_ITEMS.filter((i) => i.barraInferior);

export function BottomNav() {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen } = useSidebar();

  const baseClass =
    "flex flex-col items-center justify-center gap-1.5 rounded-[22px] py-2 transition-colors";
  const labelClass = "text-[11px] font-semibold tracking-wide";

  return (
    // Segurar o dedo num item não seleciona o rótulo nem abre a prévia de
    // link do iOS: aqui é barra de app, não texto.
    <nav className="some-com-teclado fixed inset-x-0 bottom-0 z-40 bg-sidebar/95 backdrop-blur select-none [-webkit-touch-callout:none] md:hidden">
      <div
        className="mx-auto grid max-w-md gap-1 px-3 py-3"
        style={{
          gridTemplateColumns: `repeat(${ITENS_BARRA.length + 1}, minmax(0, 1fr))`,
        }}
      >
        {ITENS_BARRA.map((item) => {
          const active = isNavItemAtivo(item, pathname);
          const Icon = item.icon;
          const content = (
            <>
              <div className="relative flex items-center justify-center">
                <Icon className="size-5" strokeWidth={2.75} />
                <LinkPendingDot className="absolute -right-2 -top-1" />
              </div>
              <span className={labelClass}>{item.label}</span>
            </>
          );
          const itemClass = cn(
            baseClass,
            active
              ? "bg-primary text-primary-foreground"
              : "text-neutral-800 active:bg-sidebar-accent",
            item.disabled && "opacity-40",
          );
          return item.disabled ? (
            <span key={item.href} className={itemClass} aria-disabled>
              {content}
            </span>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={itemClass}
            >
              {content}
            </Link>
          );
        })}

        {/* O resto do app mora no menu lateral agrupado. O ☰ do header também
            abre ele, mas fica fora do alcance do polegar. */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          className={cn(baseClass, "text-neutral-800 active:bg-sidebar-accent")}
        >
          <MenuIcon className="size-5" strokeWidth={2.75} />
          <span className={labelClass}>Menu</span>
        </button>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
