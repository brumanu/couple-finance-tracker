"use client";

import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteBanco } from "./actions";

type Props = { id: string; nome: string };

export function BancoActionsMenu({ id, nome }: Props) {
  return (
    <EntityActionsMenu
      itens={[
        itemExcluir({
          titulo: "Excluir banco",
          descricao: `Excluir o banco "${nome}"? Isso vai falhar se ainda houver cartões vinculados.`,
          acao: () => deleteBanco(id),
          sucesso: "Banco excluído.",
        }),
      ]}
    />
  );
}
