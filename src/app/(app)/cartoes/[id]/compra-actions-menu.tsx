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
import { deleteCompra } from "./actions";

type Props = { id: string; cartaoId: string; descricao: string };

export function CompraActionsMenu({ id, cartaoId, descricao }: Props) {
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
        title="Excluir compra"
        description={`Excluir "${descricao}"? Todas as parcelas somem junto.`}
        onConfirm={async () => {
          const result = await deleteCompra(id, cartaoId);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Compra excluída.");
        }}
      />
    </>
  );
}
