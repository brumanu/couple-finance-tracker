"use client";

import { useState, useTransition } from "react";
import {
  MoreVerticalIcon,
  TrashIcon,
  PowerIcon,
  StopCircleIcon,
} from "lucide-react";
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
import {
  cancelarAssinatura,
  deleteAssinatura,
  toggleAssinaturaAtiva,
} from "./assinatura-actions";

type Props = {
  id: string;
  cartaoId: string;
  descricao: string;
  ativa: boolean;
  ativaHoje: boolean;
};

export function AssinaturaActionsMenu({
  id,
  cartaoId,
  descricao,
  ativa,
  ativaHoje,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);

  const onToggle = () => {
    startTransition(async () => {
      await toggleAssinaturaAtiva(id, cartaoId, !ativa);
      toast.success(ativa ? "Assinatura desativada." : "Assinatura ativada.");
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
            {ativa ? "Desativar" : "Ativar"}
          </DropdownMenuItem>
          {ativaHoje && (
            <DropdownMenuItem onClick={() => setConfirmCancelar(true)}>
              <StopCircleIcon className="size-4" />
              Encerrar hoje
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            className="text-primary focus:text-primary"
          >
            <TrashIcon className="size-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmCancelar}
        onOpenChange={setConfirmCancelar}
        title="Encerrar assinatura"
        description={`Encerrar "${descricao}" hoje? Vai aparecer nas próximas faturas apenas até este mês.`}
        confirmLabel="Encerrar"
        onConfirm={async () => {
          const result = await cancelarAssinatura(id, cartaoId);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Assinatura encerrada.");
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir assinatura"
        description={`Excluir "${descricao}"? Some do histórico do cartão.`}
        onConfirm={async () => {
          const result = await deleteAssinatura(id, cartaoId);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Assinatura excluída.");
        }}
      />
    </>
  );
}
