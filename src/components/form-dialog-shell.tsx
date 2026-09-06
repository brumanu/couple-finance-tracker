"use client";

import { PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ControleFormDialog, EstadoForm } from "@/lib/form-dialog";

type Props<S extends EstadoForm> = {
  ctrl: ControleFormDialog<S>;
  titulo: string;
  descricao: React.ReactNode;
  /**
   * Trigger próprio (lápis da linha, FAB, botão de um estado vazio). Sem ele,
   * cai no botão "＋ {rotuloNovo}" padrão do topo das listas.
   *
   * `null` = sem trigger nenhum. É o modo usado por quem monta o dialog sob
   * demanda: o provider da lista e o FAB já têm o próprio botão fora daqui, e
   * o dialog nasce aberto por `defaultOpen`.
   */
  trigger?: React.ReactElement | null;
  rotuloNovo?: string;
  rotuloSalvar?: string;
  /** Desabilita o botão padrão — ex.: "Novo cartão" sem nenhum banco ainda. */
  triggerDesabilitado?: boolean;
  /**
   * Substitui o formulário inteiro por um aviso. Serve pro caso em que abrir
   * o dialog não leva a lugar nenhum (cadastrar cartão sem ter banco).
   */
  corpoAlternativo?: React.ReactNode;
  /** Largura no desktop. O mobile é sempre bottom-sheet de largura cheia. */
  className?: string;
  children: React.ReactNode;
};

/**
 * A casca compartilhada dos form-dialogs: Dialog + trigger + cabeçalho +
 * `<form>` + linha de erro + rodapé Cancelar/Salvar.
 *
 * Os 15 dialogs repetiam esse esqueleto inteiro — 60 linhas de JSX cada, com
 * as mesmas 7 importações de `ui/dialog`. O que sobra em cada um agora são só
 * os campos, que é a única parte que realmente difere entre eles.
 *
 * O `key` no `<form>` continua sendo o que zera os inputs não-controlados a
 * cada abertura; os controlados são zerados pelo `reset` do `useFormDialog`.
 */
export function FormDialogShell<S extends EstadoForm>({
  ctrl,
  titulo,
  descricao,
  trigger,
  rotuloNovo,
  rotuloSalvar = "Salvar",
  triggerDesabilitado,
  corpoAlternativo,
  className,
  children,
}: Props<S>) {
  return (
    <Dialog open={ctrl.open} onOpenChange={ctrl.setOpen}>
      {trigger !== null && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button size="sm" disabled={triggerDesabilitado}>
                <PlusIcon className="size-4" strokeWidth={2.75} />
                {rotuloNovo}
              </Button>
            )
          }
        />
      )}
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {corpoAlternativo ?? (
        <form
          key={ctrl.formKey}
          action={ctrl.formAction}
          className="flex flex-col gap-4"
        >
          {children}

          {ctrl.state.error && (
            <p className="text-sm text-destructive" role="alert">
              {ctrl.state.error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={ctrl.fechar}
              disabled={ctrl.pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={ctrl.pending}>
              {ctrl.pending ? "Salvando…" : rotuloSalvar}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Bloco rótulo + campo, o wrapper que aparece ~90 vezes nos formulários.
 *
 * O rótulo sai sempre em `text-xs text-muted-foreground`, que já era o padrão
 * em 14 dos 15 dialogs — só o de renda usava o `Label` no tamanho cheio.
 * Passe `rotuloClassName` se algum caso precisar fugir disso.
 */
export function CampoForm({
  htmlFor,
  rotulo,
  children,
  className,
  rotuloClassName,
}: {
  htmlFor?: string;
  rotulo: string;
  children: React.ReactNode;
  className?: string;
  rotuloClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label
        htmlFor={htmlFor}
        className={cn("text-xs text-muted-foreground", rotuloClassName)}
      >
        {rotulo}
      </Label>
      {children}
    </div>
  );
}
