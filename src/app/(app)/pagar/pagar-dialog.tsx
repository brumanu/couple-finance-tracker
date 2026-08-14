"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
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
import { hojeISO } from "@/lib/mes";
import { pagarContaRecorrente, type PagarFormState } from "./actions";

type Props = {
  contaRecorrenteId: string;
  descricao: string;
  valorPrevisto: number | string;
  dataReferencia: string; // YYYY-MM-01
  quinzena: 15 | 30;
};

const INITIAL_STATE: PagarFormState = {};

export function PagarDialog({
  contaRecorrenteId,
  descricao,
  valorPrevisto,
  dataReferencia,
  quinzena,
}: Props) {
  const [open, setOpen] = useState(false);
  const action = pagarContaRecorrente.bind(
    null,
    contaRecorrenteId,
    dataReferencia,
    quinzena,
  );
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      valor: Number(valorPrevisto).toFixed(2).replace(".", ","),
      dataHoje: hojeISO(),
      descricao,
    }),
    [valorPrevisto, descricao],
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success("Pagamento confirmado.");
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" title="Marcar como paga">
            <CheckIcon className="size-3.5" />
            Pagar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar {descricao} como paga</DialogTitle>
          <DialogDescription>
            Registre o valor real pago. Se veio diferente do previsto, ajuste
            aqui.
          </DialogDescription>
        </DialogHeader>

        <form key={open ? "open" : "closed"} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              name="descricao"
              required
              defaultValue={defaults.descricao}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor">Valor pago (R$)</Label>
              <Input
                id="valor"
                name="valor"
                required
                inputMode="decimal"
                defaultValue={defaults.valor}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_pagamento">Data</Label>
              <Input
                id="data_pagamento"
                name="data_pagamento"
                type="date"
                defaultValue={defaults.dataHoje}
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-red-600" role="alert">
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
              {pending ? "Salvando…" : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
