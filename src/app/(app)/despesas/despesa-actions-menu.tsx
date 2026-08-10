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
import { deleteDespesa } from "./actions";

type Props = { id: string; descricao: string };

export function DespesaActionsMenu({ id, descricao }: Props) {
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (!confirm(`Excluir "${descricao}"?`)) return;
    startTransition(async () => {
      await deleteDespesa(id);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Mais opções"
            disabled={pending}
          >
            <MoreVerticalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-600 focus:text-red-600"
        >
          <TrashIcon className="size-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
