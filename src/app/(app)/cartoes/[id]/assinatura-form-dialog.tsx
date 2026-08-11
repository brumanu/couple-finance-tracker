"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { RepeatIcon, PencilIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAssinatura,
  updateAssinatura,
  type AssinaturaFormState,
} from "./assinatura-actions";

export type AssinaturaRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
  categoria: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
};

type Props = {
  cartaoId: string;
  assinatura?: AssinaturaRow;
  trigger?: React.ReactElement;
};

const INITIAL_STATE: AssinaturaFormState = {};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AssinaturaFormDialog({
  cartaoId,
  assinatura,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(assinatura);
  const action = isEdit
    ? updateAssinatura.bind(null, assinatura!.id)
    : createAssinatura;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      descricao: assinatura?.descricao ?? "",
      valor_mensal:
        assinatura?.valor_mensal != null
          ? Number(assinatura.valor_mensal).toFixed(2).replace(".", ",")
          : "",
      categoria: assinatura?.categoria ?? "",
      inicio_vigencia: assinatura?.inicio_vigencia ?? todayISO(),
      fim_vigencia: assinatura?.fim_vigencia ?? "",
      ativa: assinatura?.ativa ?? true,
    }),
    [
      assinatura?.id,
      assinatura?.descricao,
      assinatura?.valor_mensal,
      assinatura?.categoria,
      assinatura?.inicio_vigencia,
      assinatura?.fim_vigencia,
      assinatura?.ativa,
    ],
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm" variant="outline">
              <RepeatIcon className="size-4" strokeWidth={2.75} />
              Nova assinatura
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar assinatura" : "Nova assinatura"}
          </DialogTitle>
          <DialogDescription>
            Cobrança que repete todo mês no cartão. Netflix, Spotify,
            mensalidades e por aí vai.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="cartao_id" value={cartaoId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao" className="text-xs text-muted-foreground">
              Descrição
            </Label>
            <Input
              id="descricao"
              name="descricao"
              required
              defaultValue={defaults.descricao}
              placeholder="Ex: Netflix, Spotify, ChatGPT…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="valor_mensal"
                className="text-xs text-muted-foreground"
              >
                Valor mensal (R$)
              </Label>
              <Input
                id="valor_mensal"
                name="valor_mensal"
                required
                inputMode="decimal"
                defaultValue={defaults.valor_mensal}
                placeholder="Ex: 55,90"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="categoria"
                className="text-xs text-muted-foreground"
              >
                Categoria (opcional)
              </Label>
              <Input
                id="categoria"
                name="categoria"
                defaultValue={defaults.categoria}
                placeholder="Ex: streaming"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="inicio_vigencia"
                className="text-xs text-muted-foreground"
              >
                Ativa desde
              </Label>
              <Input
                id="inicio_vigencia"
                name="inicio_vigencia"
                type="date"
                required
                defaultValue={defaults.inicio_vigencia}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="fim_vigencia"
                className="text-xs text-muted-foreground"
              >
                Encerra em (opcional)
              </Label>
              <Input
                id="fim_vigencia"
                name="fim_vigencia"
                type="date"
                defaultValue={defaults.fim_vigencia}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativa"
              name="ativa"
              defaultChecked={defaults.ativa}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="ativa" className="cursor-pointer">
              Assinatura ativa (entra na fatura enquanto vigente)
            </Label>
          </div>

          {state.error && (
            <p className="text-sm text-primary" role="alert">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditAssinaturaTrigger({
  assinatura,
  cartaoId,
}: {
  assinatura: AssinaturaRow;
  cartaoId: string;
}) {
  return (
    <AssinaturaFormDialog
      cartaoId={cartaoId}
      assinatura={assinatura}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
