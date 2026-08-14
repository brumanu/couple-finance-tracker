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
import { deleteDivida } from "./actions";

type Props = { id: string; descricao: string };

export function DividaActionsMenu({ id, descricao }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Mais opções"
            >
              <MoreVerticalIcon className="size-4" strokeWidth={2.75} />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-primary focus:text-primary"
          >
            <TrashIcon className="size-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir dívida"
        description={`Excluir "${descricao}"? Todos os pagamentos registrados também somem.`}
        onConfirm={async () => {
          const result = await deleteDivida(id);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Dívida excluída.");
        }}
      />
    </>
  );
}
