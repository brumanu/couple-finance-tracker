"use client";

import dynamic from "next/dynamic";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { BancoOption, CartaoRow } from "./cartao-form-dialog";

const Formulario = dynamic(() =>
  import("./cartao-form-dialog").then((m) => m.CartaoFormDialog),
);

const { Provider, BotaoNovo, BotaoEditar } = criarDialogDeLista<CartaoRow>({
  rotuloNovo: "Novo cartão",
});

export { BotaoNovo as NovoCartao, BotaoEditar as EditarCartao };

export function CartaoDialogs({
  bancos,
  children,
}: {
  bancos: BancoOption[];
  children: React.ReactNode;
}) {
  return (
    <Provider
      render={(cartao, fechar) => (
        <Formulario
          key={cartao?.id ?? "novo"}
          cartao={cartao ?? undefined}
          bancos={bancos}
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
