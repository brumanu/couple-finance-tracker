"use client";

import { useState, useTransition } from "react";
import { MoreVerticalIcon, TrashIcon, PowerIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCartao, toggleCartaoAtivo } from "./actions";

type Props = { id: string; ativo: boolean; label: string };

export function CartaoActionsMenu({ id, ativo, label }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onToggle = () => {
    startTransition(async () => {
      await toggleCartaoAtivo(id, !ativo);
      toast.success(ativo ? "Cartão desativado." : "Cartão ativado.");
    });
  };

  return (
    <>
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
        title="Excluir cartão"
        description={`Excluir o cartão "${label}"? Todas as compras vinculadas também serão excluídas.`}
        onConfirm={async () => {
          const result = await deleteCartao(id);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Cartão excluído.");
        }}
      />
    </>
  );
}
