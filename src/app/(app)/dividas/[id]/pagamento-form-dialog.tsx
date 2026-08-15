"use client";

import { useActionState, useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
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
import { formatBRL } from "@/lib/format";
import { hojeISO } from "@/lib/mes";
import {
  createPagamento,
  type PagamentoDividaFormState,
} from "./actions";

type Props = {
  dividaId: string;
  restante: number;
};

const INITIAL_STATE: PagamentoDividaFormState = {};

const todayISO = hojeISO;

export function PagamentoFormDialog({ dividaId, restante }: Props) {
  const [open, setOpen] = useState(false);
  // Fecha/notifica dentro da própria action em vez de um useEffect que
  // observa `state`: aqui já estamos numa transição, não num efeito pós-render.
  const [state, formAction, pending] = useActionState(
    async (prev: PagamentoDividaFormState, formData: FormData) => {
      const resultado = await createPagamento(prev, formData);
      if (resultado.ok) {
        setOpen(false);
        toast.success("Pagamento registrado.");
      }
      return resultado;
    },
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

        <form key={open ? "open" : "closed"} action={formAction} className="flex flex-col gap-4">
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
