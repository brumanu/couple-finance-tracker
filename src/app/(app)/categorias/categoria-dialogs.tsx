"use client";

import dynamic from "next/dynamic";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { CategoriaRow } from "./categoria-form-dialog";

const Formulario = dynamic(() =>
  import("./categoria-form-dialog").then((m) => m.CategoriaFormDialog),
);

const { Provider, BotaoNovo, BotaoEditar } = criarDialogDeLista<CategoriaRow>({
  rotuloNovo: "Nova categoria",
});

export { BotaoNovo as NovaCategoria, BotaoEditar as EditarCategoria };

export function CategoriaDialogs({ children }: { children: React.ReactNode }) {
  return (
    <Provider
      render={(categoria, fechar) => (
        <Formulario
          key={categoria?.id ?? "nova"}
          categoria={categoria ?? undefined}
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
