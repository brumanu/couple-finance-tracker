"use client";

import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteCompra } from "./actions";

type Props = { id: string; cartaoId: string; descricao: string };

export function CompraActionsMenu({ id, cartaoId, descricao }: Props) {
  return (
    <EntityActionsMenu
      itens={[
        itemExcluir({
          titulo: "Excluir compra",
          descricao: `Excluir "${descricao}"? Todas as parcelas somem junto.`,
          acao: () => deleteCompra(id, cartaoId),
          sucesso: "Compra excluída.",
        }),
      ]}
    />
  );
}
