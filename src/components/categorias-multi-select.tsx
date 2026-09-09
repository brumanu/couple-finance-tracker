"use client";

import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CategoriaOpcao } from "@/lib/categorias";

/**
 * Escolha de várias categorias de uma vez.
 *
 * Serve a dois usos que parecem diferentes mas têm a mesma mecânica:
 *
 *  - nos formulários, o campo "Outras categorias", que emite um
 *    `<input hidden>` por id escolhido (`nomeCampo`) — vários inputs de mesmo
 *    nome em vez de uma string com separador, pra que o servidor leia com
 *    `getAll` sem ter que escapar nada;
 *  - no filtro do relatório, onde não há formulário e o estado fica só no
 *    cliente (`nomeCampo` ausente).
 *
 * Usa `DropdownMenuCheckboxItem` e não o `Select`: o Select do Base UI é de
 * escolha única e fecha ao clicar, o que obrigaria a reabrir o menu a cada
 * categoria marcada.
 */

const MESMA_ALTURA_DO_SELECT =
  "flex h-9 w-full items-center justify-between gap-2 rounded-full border border-input bg-card px-4 py-2 text-base md:text-sm transition-colors outline-none select-none hover:border-[color-mix(in_srgb,var(--foreground)_45%,transparent)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

export function BolhaCategoria({
  categoria,
  className,
}: {
  categoria: CategoriaOpcao;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
        className,
      )}
      style={{ backgroundColor: categoria.cor, color: "#fff" }}
      aria-hidden
    >
      {categoria.emoji ?? categoria.nome[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

type Props = {
  id?: string;
  categorias: CategoriaOpcao[];
  value: string[];
  onValueChange: (ids: string[]) => void;
  /** Emite um `<input hidden>` por id com este nome. Só o formulário usa. */
  nomeCampo?: string;
  /** Some da lista — no formulário é a categoria principal, já escolhida. */
  excluir?: string | null;
  /**
   * Item fora do cadastro de categorias, no topo da lista. O filtro do
   * relatório usa pra "Sem categoria".
   */
  opcaoEspecial?: { valor: string; rotulo: string };
  placeholder?: string;
  disabled?: boolean;
};

export function CategoriasMultiSelect({
  id,
  categorias,
  value,
  onValueChange,
  nomeCampo,
  excluir,
  opcaoEspecial,
  placeholder = "Nenhuma",
  disabled,
}: Props) {
  const disponiveis = excluir
    ? categorias.filter((c) => c.id !== excluir)
    : categorias;

  // Marcada mas fora da lista visível: acontece quando a categoria vira a
  // principal com o dialog aberto. Fica fora do resumo pra não mostrar uma
  // seleção que o usuário não consegue desmarcar.
  const marcadas = disponiveis.filter((c) => value.includes(c.id));
  const especialMarcada =
    opcaoEspecial != null && value.includes(opcaoEspecial.valor);

  function alternar(chave: string, marcado: boolean) {
    if (marcado) {
      if (!value.includes(chave)) onValueChange([...value, chave]);
      return;
    }
    onValueChange(value.filter((v) => v !== chave));
  }

  const total = marcadas.length + (especialMarcada ? 1 : 0);

  return (
    <>
      {nomeCampo &&
        marcadas.map((c) => (
          <input key={c.id} type="hidden" name={nomeCampo} value={c.id} />
        ))}

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled || (disponiveis.length === 0 && !opcaoEspecial)}
          className={MESMA_ALTURA_DO_SELECT}
          id={id}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {total === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : total <= 2 ? (
              <>
                {especialMarcada && (
                  <span className="truncate text-muted-foreground">
                    {opcaoEspecial!.rotulo}
                  </span>
                )}
                {marcadas.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex min-w-0 items-center gap-1.5"
                  >
                    <BolhaCategoria categoria={c} />
                    <span className="truncate">{c.nome}</span>
                  </span>
                ))}
              </>
            ) : (
              <span className="truncate">{total} categorias</span>
            )}
          </span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="max-h-72">
          {opcaoEspecial && (
            <DropdownMenuCheckboxItem
              checked={especialMarcada}
              onCheckedChange={(m) => alternar(opcaoEspecial.valor, m)}
            >
              <span className="text-muted-foreground">
                {opcaoEspecial.rotulo}
              </span>
            </DropdownMenuCheckboxItem>
          )}
          {disponiveis.map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={value.includes(c.id)}
              onCheckedChange={(m) => alternar(c.id, m)}
            >
              <span className="inline-flex items-center gap-2">
                <BolhaCategoria categoria={c} />
                <span>{c.nome}</span>
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
