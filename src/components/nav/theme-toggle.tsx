"use client";

import { useSyncExternalStore } from "react";
import { SunIcon, MoonIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

// O tema vive no localStorage + na classe do <html> (um script inline decide
// antes do React montar). Lido via useSyncExternalStore: no servidor o
// snapshot é null — vira o placeholder invisível — e o valor real entra na
// hidratação, sem mismatch e sem setState dentro de effect.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): Theme | null {
  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getServerSnapshot(): Theme | null {
  return null;
}

function aplicarTema(novo: Theme): void {
  try {
    window.localStorage.setItem("theme", novo);
  } catch {}
  const el = document.documentElement;
  if (novo === "dark") el.classList.add("dark");
  else el.classList.remove("dark");
  for (const l of listeners) l();
}

type Props = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = false }: Props) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Placeholder invisível até a hidratação resolver o tema real.
  if (theme === null) {
    return (
      <button
        aria-hidden
        className={cn(
          "rounded-full p-2 text-muted-foreground opacity-0",
          className,
        )}
      >
        <SunIcon className="size-4" strokeWidth={2.75} />
      </button>
    );
  }

  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  const label = theme === "dark" ? "Modo claro" : "Modo escuro";

  return (
    <button
      type="button"
      onClick={() => aplicarTema(theme === "dark" ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2.75} />
      {showLabel && <span className="text-sm">{label}</span>}
    </button>
  );
}
