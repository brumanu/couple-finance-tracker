"use client";

import dynamic from "next/dynamic";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { BancoRow } from "./banco-form-dialog";

const Formulario = dynamic(() =>
  import("./banco-form-dialog").then((m) => m.BancoFormDialog),
);

const { Provider, BotaoNovo, BotaoEditar } = criarDialogDeLista<BancoRow>({
  rotuloNovo: "Novo banco",
});

export { BotaoNovo as NovoBanco, BotaoEditar as EditarBanco };

export function BancoDialogs({ children }: { children: React.ReactNode }) {
  return (
    <Provider
      render={(banco, fechar) => (
        <Formulario
          key={banco?.id ?? "novo"}
          banco={banco ?? undefined}
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
