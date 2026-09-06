"use client";

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
  children,
}: {
  cartoes: CartaoOpcao[];
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
  children: React.ReactNode;
}) {
  return (
    <Provider
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
