"use client";

import dynamic from "next/dynamic";
import type { CategoriaOpcao } from "@/lib/categorias";
import type { MembroOpcao } from "@/lib/membros";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { CompraFuturaRow } from "./compra-futura-form-dialog";

const Formulario = dynamic(() =>
  import("./compra-futura-form-dialog").then(
    (m) => m.CompraFuturaFormDialog,
  ),
);

const { Provider, BotaoNovo, BotaoEditar } =
  criarDialogDeLista<CompraFuturaRow>({ rotuloNovo: "Novo item" });

export { BotaoNovo as NovaCompraFutura, BotaoEditar as EditarCompraFutura };

export function CompraFuturaDialogs({
  categorias,
  membros,
  children,
}: {
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
  children: React.ReactNode;
}) {
  return (
    <Provider
      render={(item, fechar) => (
        <Formulario
          key={item?.id ?? "novo"}
          item={item ?? undefined}
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
