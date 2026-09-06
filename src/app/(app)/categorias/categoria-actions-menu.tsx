"use client";

import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteCategoria } from "./actions";

type Props = { id: string; nome: string };

export function CategoriaActionsMenu({ id, nome }: Props) {
  return (
    <EntityActionsMenu
      size="sm"
      itens={[
        itemExcluir({
          titulo: "Excluir categoria",
          descricao: `Excluir a categoria "${nome}"? Os lançamentos que a usavam ficam sem categoria.`,
          acao: () => deleteCategoria(id),
          sucesso: "Categoria excluída.",
        }),
      ]}
    />
  );
}
