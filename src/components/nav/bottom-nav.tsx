"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { LinkPendingDot } from "./link-pending-dot";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const content = (
            <>
              <div className="relative">
                <Icon className="size-5" />
                <LinkPendingDot className="absolute -right-2 -top-1" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </>
          );
          const baseClass = cn(
            "flex flex-col items-center justify-center gap-1 py-2 transition-colors",
            active ? "text-primary" : "text-muted-foreground",
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
