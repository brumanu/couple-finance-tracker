"use client";

import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteDespesa } from "./actions";

type Props = { id: string; descricao: string };

export function DespesaActionsMenu({ id, descricao }: Props) {
  return (
    <EntityActionsMenu
      size="sm"
      itens={[
        itemExcluir({
          titulo: "Excluir despesa",
          descricao: `Tem certeza que deseja excluir "${descricao}"?`,
          acao: () => deleteDespesa(id),
          sucesso: "Despesa excluída.",
        }),
      ]}
    />
  );
}
