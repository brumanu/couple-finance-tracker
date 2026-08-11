"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";
import {
  createPagamento,
  type PagamentoDividaFormState,
} from "./actions";

type Props = {
  dividaId: string;
  restante: number;
};

const INITIAL_STATE: PagamentoDividaFormState = {};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PagamentoFormDialog({ dividaId, restante }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createPagamento,
    INITIAL_STATE,
  );

  const defaults = useMemo(
    () => ({
      valor:
        restante > 0
          ? Number(restante).toFixed(2).replace(".", ",")
          : "",
      data: todayISO(),
    }),
    [restante],
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon className="size-4" strokeWidth={2.75} />
            Novo pagamento
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Falta pagar {formatBRL(restante)}. Pode ser qualquer valor até esse
            total.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="divida_id" value={dividaId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor" className="text-xs text-muted-foreground">
                Valor (R$)
              </Label>
              <Input
                id="valor"
                name="valor"
                required
                inputMode="decimal"
                defaultValue={defaults.valor}
                placeholder="Ex: 300,00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="data_pagamento"
                className="text-xs text-muted-foreground"
              >
                Data
              </Label>
              <Input
                id="data_pagamento"
                name="data_pagamento"
                type="date"
                required
                defaultValue={defaults.data}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="observacao"
              className="text-xs text-muted-foreground"
            >
              Observação (opcional)
            </Label>
            <Input
              id="observacao"
              name="observacao"
              placeholder="Ex: transferido pelo Pix"
            />
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
              {pending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
