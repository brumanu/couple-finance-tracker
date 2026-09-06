"use client";

import dynamic from "next/dynamic";
import type { CategoriaOpcao } from "@/lib/categorias";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { RendaRow } from "./renda-form-dialog";
import type { RendaExtraRow } from "./renda-extra-form-dialog";

/**
 * A tela de rendas tem duas entidades: a renda fixa que se repete todo mês e
 * a renda extra pontual. Cada uma ganha o seu provider, e os dois envolvem a
 * página inteira porque os botões de cadastro aparecem no cabeçalho e nos
 * estados vazios das duas listas.
 */

const FormRenda = dynamic(() =>
  import("./renda-form-dialog").then((m) => m.RendaFormDialog),
);

const FormRendaExtra = dynamic(() =>
  import("./renda-extra-form-dialog").then((m) => m.RendaExtraFormDialog),
);

const renda = criarDialogDeLista<RendaRow>({
  rotuloNovo: "Nova renda",
  tamanhoEditar: "sm",
});

const extra = criarDialogDeLista<RendaExtraRow>({
  rotuloNovo: "Renda extra",
});

export const NovaRenda = renda.BotaoNovo;
export const EditarRenda = renda.BotaoEditar;
export const NovaRendaExtra = extra.BotaoNovo;
export const EditarRendaExtra = extra.BotaoEditar;

export function RendaDialogs({
  categorias,
  children,
}: {
  categorias: CategoriaOpcao[];
  children: React.ReactNode;
}) {
  return (
    <renda.Provider
      render={(linha, fechar) => (
        <FormRenda
          key={linha?.id ?? "nova"}
          renda={linha ?? undefined}
          defaultOpen
          onClose={fechar}
          trigger={null}
        />
      )}
    >
      <extra.Provider
        render={(linha, fechar) => (
          <FormRendaExtra
            key={linha?.id ?? "nova"}
            rendaExtra={linha ?? undefined}
            categorias={categorias}
            defaultOpen
            onClose={fechar}
            trigger={null}
          />
        )}
      >
        {children}
      </extra.Provider>
    </renda.Provider>
  );
}
