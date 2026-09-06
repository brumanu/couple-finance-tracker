"use client";

import dynamic from "next/dynamic";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { DividaRow } from "./divida-form-dialog";

const Formulario = dynamic(() =>
  import("./divida-form-dialog").then((m) => m.DividaFormDialog),
);

const { Provider, BotaoNovo, BotaoEditar } = criarDialogDeLista<DividaRow>({
  rotuloNovo: "Nova dívida",
});

export { BotaoNovo as NovaDivida, BotaoEditar as EditarDivida };

export function DividaDialogs({ children }: { children: React.ReactNode }) {
  return (
    <Provider
      render={(divida, fechar) => (
        <Formulario
          key={divida?.id ?? "nova"}
          divida={divida ?? undefined}
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
