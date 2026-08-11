"use client";

import { useTransition } from "react";
import {
  MoreVerticalIcon,
  TrashIcon,
  PowerIcon,
  StopCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ativaHoje: boolean; // ativa + vigente no mês corrente
};

export function AssinaturaActionsMenu({
  id,
  cartaoId,
  descricao,
  ativa,
  ativaHoje,
}: Props) {
  const [pending, startTransition] = useTransition();

  const onToggle = () => {
    startTransition(async () => {
      await toggleAssinaturaAtiva(id, cartaoId, !ativa);
    });
  };

  const onCancelar = () => {
    if (
      !confirm(
        `Encerrar "${descricao}" hoje? Vai aparecer nas próximas faturas apenas até este mês.`,
      )
    )
      return;
    startTransition(async () => {
      await cancelarAssinatura(id, cartaoId);
    });
  };

  const onDelete = () => {
    if (!confirm(`Excluir "${descricao}"? Some do histórico do cartão.`))
      return;
    startTransition(async () => {
      await deleteAssinatura(id, cartaoId);
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
        <DropdownMenuItem onClick={onToggle}>
          <PowerIcon className="size-4" />
          {ativa ? "Desativar" : "Ativar"}
        </DropdownMenuItem>
        {ativaHoje && (
          <DropdownMenuItem onClick={onCancelar}>
            <StopCircleIcon className="size-4" />
            Encerrar hoje
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
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
