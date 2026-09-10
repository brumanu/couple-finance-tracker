"use client";

import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { CheckIcon, ChevronDownIcon, StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoriaOpcao } from "@/lib/categorias";
import {
  CAMPO_CATEGORIAS_EXTRAS,
  desmarcarCategoria,
  marcarCategoria,
  tornarPrincipal,
  type SelecaoCategorias,
} from "@/lib/categorias-extras";
import { BolhaCategoria } from "@/components/categorias-multi-select";

/**
 * O campo "Categorias" dos formulários de compra no cartão e de despesa.
 *
 * Um campo só no lugar de "Categoria" + "Outras categorias": a pessoa marca
 * quantas quiser e a estrela aponta a principal — a única que entra nas
 * somas dos relatórios (decisão de 08/09, ver src/lib/categorias-extras.ts).
 * As regras de marcar, desmarcar e trocar a estrela moram lá, testadas.
 *
 * Emite o mesmo que os dois campos antigos — `categoria_id` e um
 * `categorias_extras` por extra —, então as server actions não mudaram.
 *
 * Popover e não DropdownMenu: cada linha tem dois botões (marcar e estrela),
 * e item de menu não comporta um botão dentro — o clique na estrela marcaria
 * a linha também, e o teclado não chegaria nela.
 */

const GATILHO =
  "flex h-9 w-full items-center justify-between gap-2 rounded-full border border-input bg-card px-4 py-2 text-left text-base md:text-sm transition-colors outline-none select-none hover:border-[color-mix(in_srgb,var(--foreground)_45%,transparent)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  id?: string;
  categorias: CategoriaOpcao[];
  value: SelecaoCategorias;
  onValueChange: (sel: SelecaoCategorias) => void;
};

export function CategoriasComPrincipal({
  id = "categorias",
  categorias,
  value,
  onValueChange,
}: Props) {
  const porId = new Map(categorias.map((c) => [c.id, c] as const));
  const principal = value.principal ? porId.get(value.principal) : undefined;
  const extras = value.extras
    .map((e) => porId.get(e))
    .filter((c): c is CategoriaOpcao => Boolean(c));

  return (
    <>
      <input type="hidden" name="categoria_id" value={principal?.id ?? ""} />
      {principal &&
        extras.map((c) => (
          <input
            key={c.id}
            type="hidden"
            name={CAMPO_CATEGORIAS_EXTRAS}
            value={c.id}
          />
        ))}

      <Popover.Root>
        <Popover.Trigger
          id={id}
          disabled={categorias.length === 0}
          className={GATILHO}
        >
          <Resumo principal={principal} extras={extras} />
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner
            className="isolate z-50 outline-none"
            align="start"
            sideOffset={4}
          >
            <Popover.Popup className="flex max-h-[min(20rem,var(--available-height))] w-(--anchor-width) min-w-60 origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
              <p className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                A categoria com{" "}
                <StarIcon
                  className="inline size-3 -translate-y-px fill-current text-primary"
                  aria-label="estrela"
                />{" "}
                é a que entra nas somas dos relatórios.
              </p>
              <ul className="overflow-x-hidden overflow-y-auto p-1">
                {categorias.map((c) => (
                  <Linha
                    key={c.id}
                    categoria={c}
                    marcada={value.principal === c.id || value.extras.includes(c.id)}
                    ehPrincipal={value.principal === c.id}
                    aoAlternar={(marcar) =>
                      onValueChange(
                        marcar
                          ? marcarCategoria(value, c.id)
                          : desmarcarCategoria(value, c.id),
                      )
                    }
                    aoTornarPrincipal={() =>
                      onValueChange(tornarPrincipal(value, c.id))
                    }
                  />
                ))}
              </ul>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {categorias.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma cadastrada ainda.{" "}
          <Link
            href="/categorias"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Criar categoria
          </Link>
          .
        </p>
      )}
    </>
  );
}

function Resumo({
  principal,
  extras,
}: {
  principal: CategoriaOpcao | undefined;
  extras: CategoriaOpcao[];
}) {
  if (!principal) {
    return (
      <span className="flex-1 truncate text-muted-foreground">
        Sem categoria
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <BolhaCategoria categoria={principal} />
        <span className="truncate">{principal.nome}</span>
        <StarIcon
          className="size-3.5 shrink-0 fill-current text-primary"
          aria-label="principal"
        />
      </span>
      {/* As extras viram contagem: o campo ocupa meia largura do dialog, e
          dois nomes lado a lado eram espremidos até "D… ★ Alim…". A principal
          é a que importa ler aqui; as extras estão a um toque. */}
      {extras.length > 0 && (
        <span
          className="shrink-0 text-muted-foreground"
          title={extras.map((c) => c.nome).join(", ")}
        >
          <span aria-hidden>+ {extras.length}</span>
          <span className="sr-only">
            e também {extras.map((c) => c.nome).join(", ")}
          </span>
        </span>
      )}
    </span>
  );
}

function Linha({
  categoria,
  marcada,
  ehPrincipal,
  aoAlternar,
  aoTornarPrincipal,
}: {
  categoria: CategoriaOpcao;
  marcada: boolean;
  ehPrincipal: boolean;
  aoAlternar: (marcar: boolean) => void;
  aoTornarPrincipal: () => void;
}) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={marcada}
        onClick={() => aoAlternar(!marcada)}
        className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent max-md:min-h-11"
      >
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border",
            marcada
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input",
          )}
          aria-hidden
        >
          {marcada && <CheckIcon className="size-3" strokeWidth={3} />}
        </span>
        <BolhaCategoria categoria={categoria} />
        <span className="truncate">{categoria.nome}</span>
      </button>
      <button
        type="button"
        aria-pressed={ehPrincipal}
        aria-label={
          ehPrincipal
            ? `${categoria.nome} é a principal`
            : `Tornar ${categoria.nome} a principal`
        }
        title={ehPrincipal ? "Principal" : "Tornar principal"}
        onClick={aoTornarPrincipal}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:bg-accent max-md:size-11",
          ehPrincipal ? "text-primary" : "text-muted-foreground/60 hover:text-foreground",
        )}
      >
        <StarIcon
          className={cn("size-4", ehPrincipal && "fill-current")}
          strokeWidth={2.25}
        />
      </button>
    </li>
  );
}
