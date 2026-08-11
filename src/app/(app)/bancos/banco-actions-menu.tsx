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
import { deleteBanco } from "./actions";

type Props = { id: string; nome: string };

export function BancoActionsMenu({ id, nome }: Props) {
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    if (
      !confirm(
        `Excluir o banco "${nome}"? Isso vai falhar se ainda houver cartões vinculados.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteBanco(id);
      } catch (e) {
        alert(
          "Não foi possível excluir. Se existem cartões vinculados a este banco, remova-os primeiro.",
        );
        console.error(e);
      }
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
