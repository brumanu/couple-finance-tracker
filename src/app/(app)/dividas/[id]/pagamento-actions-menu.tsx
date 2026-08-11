"use client";

import { useTransition } from "react";
import { MoreVerticalIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deletePagamento } from "./actions";

type Props = { id: string; dividaId: string; valor: string };

export function PagamentoActionsMenu({ id, dividaId, valor }: Props) {
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (!confirm(`Excluir este pagamento de ${valor}?`)) return;
    startTransition(async () => {
      await deletePagamento(id, dividaId);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mais opções"
            disabled={pending}
          >
            <MoreVerticalIcon className="size-4" strokeWidth={2.75} />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onDelete}
          className="text-primary focus:text-primary"
        >
          <TrashIcon className="size-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
