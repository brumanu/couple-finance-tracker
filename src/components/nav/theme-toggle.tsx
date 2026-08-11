"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

type Props = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = false }: Props) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readInitialTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const novo: Theme = theme === "dark" ? "light" : "dark";
    setTheme(novo);
    try {
      window.localStorage.setItem("theme", novo);
    } catch {}
    const el = document.documentElement;
    if (novo === "dark") el.classList.add("dark");
    else el.classList.remove("dark");
  }

  // Renderiza um placeholder invisível até montar pra evitar mismatch
  // de hidratação (o script inline decide o tema antes de o React montar).
  if (!mounted) {
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
      onClick={toggle}
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
