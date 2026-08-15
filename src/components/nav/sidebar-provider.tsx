"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "sidebar-collapsed";

// A preferência de rail vive no localStorage, não em estado React: lida via
// useSyncExternalStore o servidor renderiza "expandido" e o cliente corrige
// na hidratação sem mismatch — e sem setState dentro de effect.
const listeners = new Set<() => void>();

function subscribeCollapsed(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getCollapsedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getCollapsedServerSnapshot(): boolean {
  return false;
}

function setCollapsedStored(valor: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, valor ? "1" : "0");
  } catch {}
  for (const l of listeners) l();
}

type SidebarContextValue = {
  /** Drawer off-canvas do mobile. */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  /** Rail só-ícones do desktop. */
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );

  // Enquanto o drawer está aberto ele é a única coisa interativa: trava o
  // scroll do fundo e deixa o Esc fechar.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsedStored(!getCollapsedSnapshot());
  }, []);

  return (
    <SidebarContext.Provider
      value={{ mobileOpen, setMobileOpen, collapsed, toggleCollapsed }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx)
    throw new Error("useSidebar deve ser usado dentro de SidebarProvider");
  return ctx;
}
