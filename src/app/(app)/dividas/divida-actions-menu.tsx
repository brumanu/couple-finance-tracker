"use client";

import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteDivida } from "./actions";

type Props = { id: string; descricao: string };

export function DividaActionsMenu({ id, descricao }: Props) {
  return (
    <EntityActionsMenu
      itens={[
        itemExcluir({
          titulo: "Excluir dívida",
          descricao: `Excluir "${descricao}"? Todos os pagamentos registrados também somem.`,
          acao: () => deleteDivida(id),
          sucesso: "Dívida excluída.",
        }),
      ]}
    />
  );
}
