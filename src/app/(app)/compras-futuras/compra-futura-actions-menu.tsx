"use client";

import { UndoIcon } from "lucide-react";
import {
  EntityActionsMenu,
  itemExcluir,
  type ItemMenu,
} from "@/components/entity-actions-menu";
import { deleteCompraFutura, reabrirCompraFutura } from "./actions";

type Props = { id: string; descricao: string; comprado: boolean };

export function CompraFuturaActionsMenu({ id, descricao, comprado }: Props) {
  const itens: ItemMenu[] = [];

  if (comprado) {
    itens.push({
      rotulo: "Voltar pra lista",
      icone: UndoIcon,
      acao: () => reabrirCompraFutura(id),
      sucesso: "Voltou pra lista.",
    });
  }

  itens.push(
    itemExcluir({
      titulo: "Excluir item",
      descricao: `Excluir "${descricao}" da lista?${
        comprado ? " A despesa lançada, se houver, continua registrada." : ""
      }`,
      acao: () => deleteCompraFutura(id),
      sucesso: "Item excluído.",
    }),
  );

  return <EntityActionsMenu size="sm" itens={itens} />;
}
