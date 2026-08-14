"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  SearchIcon,
  Loader2Icon,
  ShoppingCartIcon,
  HandCoinsIcon,
  WalletIcon,
  FileTextIcon,
  CreditCardIcon,
  RepeatIcon,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { useSearch } from "./search-provider";
import { buscarGlobal } from "./actions";
import type { SearchResultItem } from "./types";

const SECOES: {
  categoria: SearchResultItem["categoria"];
  titulo: string;
  icon: LucideIcon;
}[] = [
  { categoria: "despesa", titulo: "Despesas", icon: ShoppingCartIcon },
  { categoria: "renda_extra", titulo: "Renda extra", icon: HandCoinsIcon },
  { categoria: "renda_fixa", titulo: "Rendas fixas", icon: WalletIcon },
  { categoria: "conta_recorrente", titulo: "Contas fixas", icon: FileTextIcon },
  { categoria: "compra_cartao", titulo: "Compras no cartão", icon: CreditCardIcon },
  { categoria: "assinatura_cartao", titulo: "Assinaturas", icon: RepeatIcon },
];

export function GlobalSearchDialog() {
  const { open, setOpen } = useSearch();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<SearchResultItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fecha o modal e reseta o estado, pra não reabrir com a busca
  // anterior ainda na tela.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTexto("");
      setResultados([]);
    }
  }

  // Debounce manual: espera 300ms sem digitar antes de bater no banco.
  // Abaixo de 2 letras nem chega a agendar a busca — a UI já esconde os
  // resultados anteriores nesse caso (ver `buscou` no JSX).
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (texto.trim().length < 2) return;

    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await buscarGlobal(texto);
        setResultados(res);
      });
    }, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [texto]);

  const termo = texto.trim();
  const buscou = termo.length >= 2;

  const grupos = SECOES.map((secao) => ({
    ...secao,
    itens: resultados.filter((r) => r.categoria === secao.categoria),
  })).filter((g) => g.itens.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="fixed top-[10vh] left-1/2 z-50 flex max-h-[70dvh] w-full max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-sm text-popover-foreground shadow-[0_12px_32px_color-mix(in_srgb,var(--organic-neutral-900)_22%,transparent)] duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <DialogPrimitive.Title className="sr-only">
            Busca global
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Busque por qualquer lançamento pela descrição, em qualquer mês.
          </DialogPrimitive.Description>

          <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-5 py-4">
            {isPending ? (
              <Loader2Icon
                className="size-[18px] shrink-0 animate-spin text-muted-foreground"
                strokeWidth={2.75}
              />
            ) : (
              <SearchIcon
                className="size-[18px] shrink-0 text-muted-foreground"
                strokeWidth={2.75}
              />
            )}
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por descrição…"
              className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline-block">
              Esc
            </kbd>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {!buscou ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
                <p className="text-[15px] font-medium">
                  {termo.length === 0
                    ? "Digite pra buscar"
                    : "Continue digitando…"}
                </p>
                <p className="max-w-[38ch] text-xs text-muted-foreground">
                  {termo.length === 0
                    ? "Encontre despesas, rendas, contas fixas, compras e assinaturas do cartão de qualquer mês."
                    : "Pelo menos 2 letras pra começar a busca."}
                </p>
                {termo.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Abra essa busca de qualquer página com{" "}
                    <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[11px]">
                      ⌘K
                    </kbd>
                  </p>
                )}
              </div>
            ) : grupos.length === 0 && !isPending ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
                <p className="text-[15px] font-medium">
                  Nenhum lançamento encontrado
                </p>
                <p className="max-w-[38ch] text-xs text-muted-foreground">
                  Não achamos nada com “{termo}”. Tente outra palavra da
                  descrição.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {grupos.map((grupo) => (
                  <div key={grupo.categoria} className="flex flex-col">
                    <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                      <grupo.icon className="size-3" strokeWidth={2.75} />
                      {grupo.titulo}
                    </p>
                    {grupo.itens.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => handleOpenChange(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-sidebar-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">
                            {item.titulo}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.subtitulo}
                          </p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-[14px] font-medium tabular-nums">
                          {formatBRL(item.valor)}
                        </span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
