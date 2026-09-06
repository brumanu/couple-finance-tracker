"use client";

import { PowerIcon } from "lucide-react";
import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteCartao, toggleCartaoAtivo } from "./actions";

type Props = { id: string; ativo: boolean; label: string };

export function CartaoActionsMenu({ id, ativo, label }: Props) {
  return (
    <EntityActionsMenu
      itens={[
        {
          rotulo: ativo ? "Desativar" : "Ativar",
          icone: PowerIcon,
          acao: () => toggleCartaoAtivo(id, !ativo),
          sucesso: ativo ? "Cartão desativado." : "Cartão ativado.",
        },
        itemExcluir({
          titulo: "Excluir cartão",
          descricao: `Excluir o cartão "${label}"? Todas as compras vinculadas também serão excluídas.`,
          acao: () => deleteCartao(id),
          sucesso: "Cartão excluído.",
        }),
      ]}
    />
  );
}
