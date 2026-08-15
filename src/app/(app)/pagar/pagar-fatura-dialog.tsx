"use client";

import { useActionState, useMemo, useState } from "react";
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
import { pagarFatura, type PagarFormState } from "./actions";

type Props = {
  cartaoId: string;
  /** Rótulo do cartão, ex: "C6 Bank · Jacqueline". */
  label: string;
  totalFatura: number;
  /** Primeiro dia do mês da fatura (YYYY-MM-01). */
  mesReferencia: string;
};

const INITIAL_STATE: PagarFormState = {};

export function PagarFaturaDialog({
  cartaoId,
  label,
  totalFatura,
  mesReferencia,
}: Props) {
  const [open, setOpen] = useState(false);
  const action = pagarFatura.bind(null, cartaoId, mesReferencia);
  // Fecha/notifica dentro da própria action em vez de um useEffect que
  // observa `state`: aqui já estamos numa transição, não num efeito pós-render.
  const [state, formAction, pending] = useActionState(
    async (prev: PagarFormState, formData: FormData) => {
      const resultado = await action(prev, formData);
      if (resultado.ok) {
        setOpen(false);
        toast.success("Fatura marcada como paga.");
      }
      return resultado;
    },
    INITIAL_STATE,
  );

  const defaults = useMemo(
    () => ({
      valor: totalFatura.toFixed(2).replace(".", ","),
      dataHoje: hojeISO(),
    }),
    [totalFatura],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" title="Marcar fatura como paga">
            <CheckIcon className="size-3.5" />
            Pagar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar fatura {label} como paga</DialogTitle>
          <DialogDescription>
            Registre o valor real pago. As compras do cartão continuam
            intactas — isto só marca a fatura como quitada.
          </DialogDescription>
        </DialogHeader>

        <form
          key={open ? "open" : "closed"}
          action={formAction}
          className="flex flex-col gap-4"
        >
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
