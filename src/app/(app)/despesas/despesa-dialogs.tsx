"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import type { CategoriaOpcao } from "@/lib/categorias";
import type { MembroOpcao } from "@/lib/membros";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { DespesaRow } from "./despesa-form-dialog";

// O formulário arrasta Select, Dialog e floating-ui junto. Carregado só no
// primeiro clique, ele sai do bundle inicial de /despesas.
const Formulario = dynamic(() =>
  import("./despesa-form-dialog").then((m) => m.DespesaFormDialog),
);

const { Provider, BotaoNovo, BotaoEditar } = criarDialogDeLista<DespesaRow>({
  rotuloNovo: "Lançar despesa",
});

export { BotaoNovo as NovaDespesa, BotaoEditar as EditarDespesa };

export function DespesaDialogs({
  cartoes,
  categorias,
  membros,
  abrirNovo = false,
  children,
}: {
  cartoes: CartaoOpcao[];
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
  /** Veio do atalho "Lançar despesa" do ícone do app (`?nova=1`). */
  abrirNovo?: boolean;
  children: React.ReactNode;
}) {
  // Tira o `?nova=1` da URL assim que o formulário abre: senão recarregar a
  // página ou voltar pra ela no histórico abriria o cadastro de novo.
  // replaceState (e não router.replace) pra não refazer as consultas.
  useEffect(() => {
    if (!abrirNovo) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("nova");
    window.history.replaceState(null, "", url);
  }, [abrirNovo]);

  return (
    <Provider
      abrirNovoAoMontar={abrirNovo}
      render={(despesa, fechar) => (
        <Formulario
          key={despesa?.id ?? "nova"}
          despesa={despesa ?? undefined}
          cartoes={cartoes}
          categorias={categorias}
          membros={membros}
          defaultOpen
          onClose={fechar}
          trigger={null}
        />
      )}
    >
      {children}
    </Provider>
  );
}
