"use client";

import dynamic from "next/dynamic";
import type { CategoriaOpcao } from "@/lib/categorias";
import type { MembroOpcao } from "@/lib/membros";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { RecorrenteRow } from "./recorrente-form-dialog";

const Formulario = dynamic(() =>
  import("./recorrente-form-dialog").then((m) => m.RecorrenteFormDialog),
);

const { Provider, BotaoNovo, BotaoEditar } = criarDialogDeLista<RecorrenteRow>({
  rotuloNovo: "Nova conta",
  tamanhoEditar: "sm",
});

export { BotaoNovo as NovaRecorrente, BotaoEditar as EditarRecorrente };

export function RecorrenteDialogs({
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
      render={(recorrente, fechar) => (
        <Formulario
          key={recorrente?.id ?? "nova"}
          recorrente={recorrente ?? undefined}
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
