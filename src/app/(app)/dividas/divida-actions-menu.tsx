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
import { deleteDivida } from "./actions";

type Props = { id: string; descricao: string };

export function DividaActionsMenu({ id, descricao }: Props) {
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (
      !confirm(
        `Excluir "${descricao}"? Todos os pagamentos registrados também somem.`,
      )
    )
      return;
    startTransition(async () => {
      await deleteDivida(id);
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
