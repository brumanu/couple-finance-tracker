"use client";

import {
  EntityActionsMenu,
  itemExcluir,
} from "@/components/entity-actions-menu";
import { deletePagamento } from "./actions";

type Props = { id: string; dividaId: string; valor: string };

export function PagamentoActionsMenu({ id, dividaId, valor }: Props) {
  return (
    <EntityActionsMenu
      itens={[
        itemExcluir({
          titulo: "Excluir pagamento",
          descricao: `Tem certeza que deseja excluir este pagamento de ${valor}?`,
          acao: () => deletePagamento(id, dividaId),
          sucesso: "Pagamento excluído.",
        }),
      ]}
    />
  );
}
