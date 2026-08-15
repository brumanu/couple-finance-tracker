"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { playCoinSound } from "@/lib/sound";
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
import { marcarComprada, type CompraFuturaFormState } from "./actions";

type Props = {
  id: string;
  descricao: string;
  valorEstimado: number | null;
};

const INITIAL_STATE: CompraFuturaFormState = {};

export function CompreiDialog({ id, descricao, valorEstimado }: Props) {
  const [open, setOpen] = useState(false);
  const action = marcarComprada.bind(null, id);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const [lancar, setLancar] = useState(true);

  const defaults = useMemo(
    () => ({
      valor:
        valorEstimado != null
          ? valorEstimado.toFixed(2).replace(".", ",")
          : "",
      hoje: hojeISO(),
    }),
    [valorEstimado],
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success("Marcado como comprado.");
      playCoinSound();
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" title="Marcar como comprado">
            <CheckIcon className="size-3.5" />
            Comprei
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comprei &ldquo;{descricao}&rdquo;</DialogTitle>
          <DialogDescription>
            O item sai da lista de desejos. Se quiser, já lanço a despesa
            junto — categoria e quem quer vêm do próprio item.
          </DialogDescription>
        </DialogHeader>

        <form
          key={open ? "open" : "closed"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_compra" className="text-xs text-muted-foreground">
              Data da compra
            </Label>
            <Input
              id="data_compra"
              name="data_compra"
              type="date"
              defaultValue={defaults.hoje}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border/60 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="lancar_despesa"
                checked={lancar}
                onChange={(e) => setLancar(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Lançar como despesa
            </label>
            {lancar && (
              <div className="flex flex-col gap-2 pl-6 pt-1">
                <Label htmlFor="valor" className="text-xs text-muted-foreground">
                  Valor pago (R$)
                </Label>
                <Input
                  id="valor"
                  name="valor"
                  required
                  inputMode="decimal"
                  defaultValue={defaults.valor}
                  placeholder="Ex: 2500,00"
                  className="max-w-[180px]"
                />
                <p className="text-xs text-muted-foreground">
                  Cria uma despesa avulsa. Se foi no cartão, deixe
                  desmarcado e cadastre a compra pelo cartão.
                </p>
              </div>
            )}
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
              {pending ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
