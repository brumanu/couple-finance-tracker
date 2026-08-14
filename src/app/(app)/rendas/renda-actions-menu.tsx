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
import { deleteRenda, toggleRendaAtiva } from "./actions";

type Props = {
  id: string;
  ativa: boolean;
  descricao: string;
};

export function RendaActionsMenu({ id, ativa, descricao }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onToggle = () => {
    startTransition(async () => {
      await toggleRendaAtiva(id, !ativa);
      toast.success(ativa ? "Renda desativada." : "Renda ativada.");
    });
  };

  return (
    <>
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
          <DropdownMenuItem onClick={onToggle}>
            <PowerIcon className="size-4" />
            {ativa ? "Desativar" : "Ativar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
        title="Excluir renda"
        description={`Tem certeza que deseja excluir a renda "${descricao}"?`}
        onConfirm={async () => {
          const result = await deleteRenda(id);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Renda excluída.");
        }}
      />
    </>
  );
}
