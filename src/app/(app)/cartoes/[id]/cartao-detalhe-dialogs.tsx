"use client";

import dynamic from "next/dynamic";
import { RepeatIcon } from "lucide-react";
import type { CategoriaOpcao } from "@/lib/categorias";
import type { MembroOpcao } from "@/lib/membros";
import { criarDialogDeLista } from "@/lib/dialog-de-lista";
import type { CompraRow } from "./compra-form-dialog";
import type { AssinaturaRow } from "./assinatura-form-dialog";

/**
 * A tela do cartão tem duas listas — compras e assinaturas — e cada uma tinha
 * um dialog por linha. Aqui as duas passam a compartilhar um dialog cada,
 * montado sob demanda: é a rota com mais linhas do app.
 */

const FormCompra = dynamic(() =>
  import("./compra-form-dialog").then((m) => m.CompraFormDialog),
);

const FormAssinatura = dynamic(() =>
  import("./assinatura-form-dialog").then((m) => m.AssinaturaFormDialog),
);

const compra = criarDialogDeLista<CompraRow>({ rotuloNovo: "Nova compra" });

const assinatura = criarDialogDeLista<AssinaturaRow>({
  rotuloNovo: "Nova assinatura",
  iconeNovo: RepeatIcon,
  variantNovo: "outline",
});

export const NovaCompra = compra.BotaoNovo;
export const EditarCompra = compra.BotaoEditar;
export const NovaAssinatura = assinatura.BotaoNovo;
export const EditarAssinatura = assinatura.BotaoEditar;

export function CartaoDetalheDialogs({
  cartaoId,
  diaFechamento,
  diaVencimento,
  categorias,
  membros,
  children,
}: {
  cartaoId: string;
  diaFechamento: number;
  diaVencimento: number;
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
  children: React.ReactNode;
}) {
  return (
    <compra.Provider
      render={(linha, fechar) => (
        <FormCompra
          key={linha?.id ?? "nova"}
          cartaoId={cartaoId}
          diaFechamento={diaFechamento}
          diaVencimento={diaVencimento}
          compra={linha ?? undefined}
          categorias={categorias}
          membros={membros}
          defaultOpen
          onClose={fechar}
          trigger={null}
        />
      )}
    >
      <assinatura.Provider
        render={(linha, fechar) => (
          <FormAssinatura
            key={linha?.id ?? "nova"}
            cartaoId={cartaoId}
            assinatura={linha ?? undefined}
            categorias={categorias}
            membros={membros}
            defaultOpen
            onClose={fechar}
            trigger={null}
          />
        )}
      >
        {children}
      </assinatura.Provider>
    </compra.Provider>
  );
}
