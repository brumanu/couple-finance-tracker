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
import { deleteCategoria } from "./actions";

type Props = { id: string; nome: string };

export function CategoriaActionsMenu({ id, nome }: Props) {
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (
      !confirm(
        `Excluir a categoria "${nome}"? Os lançamentos que a usavam ficam sem categoria.`,
      )
    )
      return;
    startTransition(async () => {
      await deleteCategoria(id);
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
