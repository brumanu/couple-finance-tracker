"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { LinkPendingDot } from "./link-pending-dot";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-sidebar/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1 px-3 py-3">
        {NAV_ITEMS.filter((i) => !i.desktopOnly).map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const content = (
            <>
              <div className="relative flex items-center justify-center">
                <Icon className="size-5" strokeWidth={2.75} />
                <LinkPendingDot className="absolute -right-2 -top-1" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide">
                {item.label}
              </span>
            </>
          );
          const baseClass = cn(
            "flex flex-col items-center justify-center gap-1.5 rounded-[22px] py-2 transition-colors",
            active
              ? "bg-primary text-primary-foreground"
              : "text-neutral-800",
            item.disabled && "opacity-40",
          );
          return item.disabled ? (
            <span key={item.href} className={baseClass} aria-disabled>
              {content}
            </span>
          ) : (
            <Link key={item.href} href={item.href} className={baseClass}>
              {content}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
