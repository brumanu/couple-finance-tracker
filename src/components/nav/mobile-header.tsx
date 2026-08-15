"use client";

import { MenuIcon, SearchIcon } from "lucide-react";
import { useSearch } from "@/components/search/search-provider";
import { useSidebar } from "./sidebar-provider";

type Props = {
  nomeCasal: string;
  nomeUsuario: string;
};

function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function MobileHeader({ nomeCasal, nomeUsuario }: Props) {
  const { setOpen: setSearchOpen } = useSearch();
  const { setMobileOpen } = useSidebar();

  return (
    <header className="flex items-center gap-2 px-3 pt-6 pb-2 md:hidden">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-200 hover:text-foreground"
      >
        <MenuIcon className="size-[20px]" strokeWidth={2.75} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="font-heading text-[20px] leading-none">Financeiro</p>
        <p className="mt-1 truncate text-[13px] text-neutral-700">
          {nomeCasal}
        </p>
      </div>

      {/* Relatórios, categorias, tema, notificações e sair moraram aqui até
          virarem itens do menu lateral — só a busca continua no header, por
          ser a ação mais usada. */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Buscar"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-200 hover:text-foreground"
      >
        <SearchIcon className="size-[18px]" strokeWidth={2.75} />
      </button>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-300 font-heading text-[15px] text-sage-800">
        {iniciais(nomeUsuario) || "?"}
      </div>
    </header>
  );
}
