"use client";

import { PowerIcon } from "lucide-react";
import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deleteRecorrente, toggleRecorrenteAtiva } from "./actions";

type Props = { id: string; ativa: boolean; descricao: string };

export function RecorrenteActionsMenu({ id, ativa, descricao }: Props) {
  return (
    <EntityActionsMenu
      size="sm"
      itens={[
        {
          rotulo: ativa ? "Desativar" : "Ativar",
          icone: PowerIcon,
          acao: () => toggleRecorrenteAtiva(id, !ativa),
          sucesso: ativa ? "Conta desativada." : "Conta ativada.",
        },
        itemExcluir({
          titulo: "Excluir conta recorrente",
          descricao: `Tem certeza que deseja excluir a conta "${descricao}"?`,
          acao: () => deleteRecorrente(id),
          sucesso: "Conta recorrente excluída.",
        }),
      ]}
    />
  );
}
