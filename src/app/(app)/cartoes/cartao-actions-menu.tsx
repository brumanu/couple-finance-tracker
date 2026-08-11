"use client";

import { useTransition } from "react";
import { MoreVerticalIcon, TrashIcon, PowerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteCartao, toggleCartaoAtivo } from "./actions";

type Props = { id: string; ativo: boolean; label: string };

export function CartaoActionsMenu({ id, ativo, label }: Props) {
  const [pending, startTransition] = useTransition();

  const onToggle = () => {
    startTransition(async () => {
      await toggleCartaoAtivo(id, !ativo);
    });
  };

  const onDelete = () => {
    if (
      !confirm(
        `Excluir o cartão "${label}"? Todas as compras vinculadas também serão excluídas.`,
      )
    )
      return;
    startTransition(async () => {
      await deleteCartao(id);
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
        <DropdownMenuItem onClick={onToggle}>
          <PowerIcon className="size-4" />
          {ativo ? "Desativar" : "Ativar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
