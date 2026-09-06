"use client";

import { PowerIcon } from "lucide-react";
import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteRenda, toggleRendaAtiva } from "./actions";

type Props = { id: string; ativa: boolean; descricao: string };

export function RendaActionsMenu({ id, ativa, descricao }: Props) {
  return (
    <EntityActionsMenu
      size="sm"
      itens={[
        {
          rotulo: ativa ? "Desativar" : "Ativar",
          icone: PowerIcon,
          acao: () => toggleRendaAtiva(id, !ativa),
          sucesso: ativa ? "Renda desativada." : "Renda ativada.",
        },
        itemExcluir({
          titulo: "Excluir renda",
          descricao: `Tem certeza que deseja excluir a renda "${descricao}"?`,
          acao: () => deleteRenda(id),
          sucesso: "Renda excluída.",
        }),
      ]}
    />
  );
}
