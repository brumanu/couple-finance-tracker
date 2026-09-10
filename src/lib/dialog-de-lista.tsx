"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Um dialog por lista, em vez de um por linha.
 *
 * O padrão antigo era `<EditXTrigger x={linha} />` dentro do `map` da lista:
 * cada linha montava um `<XFormDialog>` inteiro — `useActionState`, portal,
 * Select, floating-ui — e o módulo do dialog entrava no bundle inicial da
 * rota mesmo sem ninguém clicar em nada. Numa lista de 50 despesas eram 50
 * dialogs hidratados pra, no máximo, um ser aberto.
 *
 * Aqui a lista inteira compartilha um dialog só, montado sob demanda:
 *
 *   - o `Provider` guarda qual linha está sendo editada (`null` = cadastro
 *     novo) e só renderiza o dialog quando há alguma;
 *   - `BotaoNovo` e `BotaoEditar` são botões leves que apenas chamam o
 *     provider — nenhum deles importa o formulário;
 *   - quem chama `criarDialogDeLista` carrega o formulário por
 *     `next/dynamic`, então o JS dele sai do bundle inicial e só baixa no
 *     primeiro clique.
 *
 * O `render` fica a cargo de cada lista porque as props do formulário mudam
 * (cartões, categorias, membros, id do cartão…) e função não atravessa a
 * fronteira servidor→cliente: por isso cada entidade tem o seu arquivo
 * `*-dialogs.tsx`, que é client component e fecha sobre o `dynamic`.
 */
export function criarDialogDeLista<TRow extends { id: string }>(opcoes: {
  /** Texto do botão de cadastro, ex.: "Nova conta". */
  rotuloNovo: string;
  /** Ícone do botão de cadastro. Padrão: "+". */
  iconeNovo?: LucideIcon;
  variantNovo?: "default" | "outline";
  /** Tamanho do lápis de editar, pra casar com a densidade de cada lista. */
  tamanhoEditar?: "sm" | "icon-sm";
}) {
  const {
    rotuloNovo,
    iconeNovo: IconeNovo = PlusIcon,
    variantNovo = "default",
    tamanhoEditar = "icon-sm",
  } = opcoes;

  const Ctx = createContext<((linha: TRow | null) => void) | null>(null);

  function useAbrir() {
    const abrir = useContext(Ctx);
    if (!abrir) {
      throw new Error(
        `Botão de "${rotuloNovo}" usado fora do provider da lista.`,
      );
    }
    return abrir;
  }

  function Provider({
    children,
    render,
    abrirNovoAoMontar = false,
  }: {
    children: React.ReactNode;
    /** `linha` é `null` quando o usuário clicou em cadastrar. */
    render: (linha: TRow | null, fechar: () => void) => React.ReactNode;
    /** Já monta com o cadastro aberto — atalho do app (`?nova=1`). */
    abrirNovoAoMontar?: boolean;
  }) {
    // `{ linha }` embrulhado num objeto pra distinguir "nenhum dialog aberto"
    // (null) de "aberto em modo cadastro" (linha null).
    const [alvo, setAlvo] = useState<{ linha: TRow | null } | null>(() =>
      abrirNovoAoMontar ? { linha: null } : null,
    );

    // Estável entre renders: sem isso todo botão da lista re-renderizaria a
    // cada abertura do dialog.
    const abrir = useMemo(() => (linha: TRow | null) => setAlvo({ linha }), []);

    return (
      <Ctx.Provider value={abrir}>
        {children}
        {alvo && render(alvo.linha, () => setAlvo(null))}
      </Ctx.Provider>
    );
  }

  function BotaoNovo({
    className,
    rotulo = rotuloNovo,
    variant = variantNovo,
    semIcone,
    disabled,
  }: {
    className?: string;
    /** Sobrescreve o texto — a mesma lista às vezes chama o botão de outro
     * jeito no cabeçalho e no estado vazio ("Renda fixa" vs "Nova renda"). */
    rotulo?: string;
    variant?: "default" | "outline";
    semIcone?: boolean;
    disabled?: boolean;
  }) {
    const abrir = useAbrir();
    return (
      <Button
        size="sm"
        variant={variant}
        className={className}
        disabled={disabled}
        onClick={() => abrir(null)}
      >
        {!semIcone && <IconeNovo className="size-4" strokeWidth={2.75} />}
        {rotulo}
      </Button>
    );
  }

  function BotaoEditar({ linha }: { linha: TRow }) {
    const abrir = useAbrir();
    return (
      <Button
        variant="ghost"
        size={tamanhoEditar}
        aria-label="Editar"
        onClick={() => abrir(linha)}
      >
        <PencilIcon className="size-4" strokeWidth={2.75} />
      </Button>
    );
  }

  return { Provider, BotaoNovo, BotaoEditar };
}
