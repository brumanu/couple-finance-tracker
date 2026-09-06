"use client";

import { PowerIcon, StopCircleIcon } from "lucide-react";
import {
  EntityActionsMenu,
  itemExcluir,
  type ItemMenu,
} from "@/components/entity-actions-menu";
import {
  cancelarAssinatura,
  deleteAssinatura,
  toggleAssinaturaAtiva,
} from "./assinatura-actions";

type Props = {
  id: string;
  cartaoId: string;
  descricao: string;
  ativa: boolean;
  ativaHoje: boolean;
};

export function AssinaturaActionsMenu({
  id,
  cartaoId,
  descricao,
  ativa,
  ativaHoje,
}: Props) {
  const itens: ItemMenu[] = [
    {
      rotulo: ativa ? "Desativar" : "Ativar",
      icone: PowerIcon,
      acao: () => toggleAssinaturaAtiva(id, cartaoId, !ativa),
      sucesso: ativa ? "Assinatura desativada." : "Assinatura ativada.",
    },
  ];

  // "Encerrar hoje" só faz sentido enquanto a vigência ainda está correndo.
  if (ativaHoje) {
    itens.push({
      rotulo: "Encerrar hoje",
      icone: StopCircleIcon,
      acao: () => cancelarAssinatura(id, cartaoId),
      sucesso: "Assinatura encerrada.",
      confirmar: {
        titulo: "Encerrar assinatura",
        descricao: `Encerrar "${descricao}" hoje? Vai aparecer nas próximas faturas apenas até este mês.`,
        rotuloConfirmar: "Encerrar",
      },
    });
  }

  itens.push(
    itemExcluir({
      titulo: "Excluir assinatura",
      descricao: `Excluir "${descricao}"? Some do histórico do cartão.`,
      acao: () => deleteAssinatura(id, cartaoId),
      sucesso: "Assinatura excluída.",
    }),
  );

  return <EntityActionsMenu itens={itens} />;
}
