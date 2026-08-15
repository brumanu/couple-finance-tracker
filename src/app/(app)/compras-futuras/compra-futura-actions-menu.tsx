"use client";

import { useState } from "react";
import { MoreVerticalIcon, TrashIcon, UndoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCompraFutura, reabrirCompraFutura } from "./actions";

type Props = {
  id: string;
  descricao: string;
  comprado: boolean;
};

export function CompraFuturaActionsMenu({ id, descricao, comprado }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" aria-label="Mais opções">
              <MoreVerticalIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {comprado && (
            <DropdownMenuItem
              onClick={async () => {
                const result = await reabrirCompraFutura(id);
                if (result?.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Voltou pra lista.");
              }}
            >
              <UndoIcon className="size-4" />
              Voltar pra lista
            </DropdownMenuItem>
          )}
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
        title="Excluir item"
        description={`Excluir "${descricao}" da lista? ${
          comprado
            ? "A despesa lançada, se houver, continua registrada."
            : ""
        }`}
        onConfirm={async () => {
          const result = await deleteCompraFutura(id);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Item excluído.");
        }}
      />
    </>
  );
}
