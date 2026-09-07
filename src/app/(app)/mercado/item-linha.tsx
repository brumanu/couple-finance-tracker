"use client";

import { CheckIcon, MoreHorizontalIcon, PackageXIcon, RotateCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import type { ItemMercado } from "@/lib/mercado";
import { useSwipeItem } from "./use-swipe-item";

type Props = {
  item: ItemMercado;
  /** Toque na linha: joga no carrinho ou desfaz. */
  aoAlternarCarrinho: () => void;
  /** Arrasto pra esquerda: marca/desmarca "não encontrei". */
  aoAlternarNaoEncontrado: () => void;
  /** Abre a folha de quantidade/preço/remover. */
  aoAbrirDetalhe: () => void;
  /** Pisca depois de o usuário tentar cadastrar um item que já existia. */
  destacado?: boolean;
};

export function ItemLinha({
  item,
  aoAlternarCarrinho,
  aoAlternarNaoEncontrado,
  aoAbrirDetalhe,
  destacado,
}: Props) {
  const swipe = useSwipeItem({ aoComitar: aoAlternarNaoEncontrado });

  const noCarrinho = item.status === "carrinho";
  const faltou = item.status === "nao_encontrado";
  const riscado = noCarrinho || faltou;

  return (
    <li className="relative overflow-hidden">
      {/*
        Fundo revelado pelo arrasto. Fica atrás da linha e não recebe toque —
        o gesto inteiro acontece na camada de cima.
      */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-end gap-2 pr-5 text-sm font-semibold transition-colors",
          swipe.vaiComitar
            ? "bg-amber-800 text-amber-50"
            : "bg-amber-800/30 text-amber-950",
        )}
      >
        {faltou ? (
          <>
            <RotateCcwIcon className="size-4" />
            Voltar pra lista
          </>
        ) : (
          <>
            <PackageXIcon className="size-4" />
            Não encontrei
          </>
        )}
      </div>

      <div
        {...swipe.handlers}
        style={{ transform: `translateX(${swipe.deslocamento}px)` }}
        className={cn(
          "relative flex items-center gap-3 bg-card px-4 py-3.5",
          // `pan-y` entrega a rolagem vertical pro navegador e deixa o
          // horizontal com o hook. Sem isso o gesto briga com o scroll.
          "touch-pan-y select-none",
          !swipe.arrastando && "transition-transform duration-200",
          destacado && "animate-pulse bg-primary/10",
        )}
      >
        {/*
          A linha inteira é o alvo do toque — é a maior área possível pra quem
          está com uma mão só. Editar quantidade/preço mora no botão de
          reticências, que tem alvo próprio e para a propagação.
        */}
        <button
          type="button"
          onClick={aoAlternarCarrinho}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-pressed={noCarrinho}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              noCarrinho
                ? "border-primary bg-primary text-primary-foreground"
                : faltou
                  ? "border-amber-800/40 bg-amber-800/10"
                  : "border-border",
            )}
            aria-hidden
          >
            {noCarrinho && <CheckIcon className="size-4" strokeWidth={3} />}
            {faltou && <PackageXIcon className="size-3.5 text-amber-900" />}
          </span>

          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={cn(
                "truncate text-[17px] leading-tight md:text-base",
                riscado && "text-muted-foreground line-through",
              )}
            >
              {item.nome}
              {item.quantidade && (
                <span className="ml-2 text-sm text-muted-foreground no-underline">
                  {item.quantidade}
                </span>
              )}
            </span>

            {item.faltou_antes && !riscado && (
              <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">
                faltou da última vez
              </span>
            )}
          </span>

          {item.preco != null && (
            <span
              className={cn(
                "shrink-0 text-sm tabular-nums",
                riscado ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {formatBRL(item.preco)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            aoAbrirDetalhe();
          }}
          className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5"
          aria-label={`Editar ${item.nome}`}
        >
          <MoreHorizontalIcon className="size-5" />
        </button>
      </div>
    </li>
  );
}
