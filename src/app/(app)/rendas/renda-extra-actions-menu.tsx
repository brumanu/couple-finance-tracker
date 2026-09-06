"use client";

import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteRendaExtra } from "./renda-extra-actions";

type Props = { id: string; descricao: string };

export function RendaExtraActionsMenu({ id, descricao }: Props) {
  return (
    <EntityActionsMenu
      size="sm"
      itens={[
        itemExcluir({
          titulo: "Excluir renda extra",
          descricao: `Tem certeza que deseja excluir "${descricao}"?`,
          acao: () => deleteRendaExtra(id),
          sucesso: "Renda extra excluída.",
        }),
      ]}
    />
  );
}
