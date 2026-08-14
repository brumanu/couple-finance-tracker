"use client";

import { useState } from "react";
import { MoreVerticalIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCategoria } from "./actions";

type Props = { id: string; nome: string };

export function CategoriaActionsMenu({ id, nome }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Mais opções"
            >
              <MoreVerticalIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            <TrashIcon className="size-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir categoria"
        description={`Excluir a categoria "${nome}"? Os lançamentos que a usavam ficam sem categoria.`}
        onConfirm={async () => {
          const result = await deleteCategoria(id);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Categoria excluída.");
        }}
      />
    </>
  );
}
