"use client";

import { useActionState, useMemo, useState } from "react";
import { PlusIcon, PencilIcon } from "lucide-react";
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
import { createNotaMei, updateNotaMei, type NotaMeiFormState } from "./actions";

export type NotaMeiRow = {
  id: string;
  empresa: string;
  valor: number | string;
  data_emissao: string;
};

type Props = {
  nota?: NotaMeiRow;
  trigger?: React.ReactElement;
  /** Empresas já usadas, pra autocompletar quem emite sempre pros mesmos. */
  empresas?: string[];
};

const INITIAL_STATE: NotaMeiFormState = {};

export function NotaMeiFormDialog({ nota, trigger, empresas = [] }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(nota);
  const action = isEdit ? updateNotaMei.bind(null, nota!.id) : createNotaMei;

  // Fecha/notifica dentro da própria action em vez de um useEffect que
  // observa `state`: aqui já estamos numa transição, não num efeito pós-render.
  const [state, formAction, pending] = useActionState(
    async (prev: NotaMeiFormState, formData: FormData) => {
      const resultado = await action(prev, formData);
      if (resultado.ok) {
        setOpen(false);
        toast.success(isEdit ? "Nota atualizada." : "Nota registrada.");
        if (!isEdit) playCoinSound();
      }
      return resultado;
    },
    INITIAL_STATE,
  );

  const defaults = useMemo(
    () => ({
      empresa: nota?.empresa ?? "",
      valor:
        nota?.valor != null
          ? Number(nota.valor).toFixed(2).replace(".", ",")
          : "",
      data_emissao: nota?.data_emissao ?? hojeISO(),
    }),
    [nota?.id, nota?.empresa, nota?.valor, nota?.data_emissao],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm">
              <PlusIcon className="size-4" strokeWidth={2.75} />
              Nova nota
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar nota" : "Nova nota"}</DialogTitle>
          <DialogDescription>
            O faturamento conta pelo ano da data de emissão.
          </DialogDescription>
        </DialogHeader>

        <form
          key={open ? "open" : "closed"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="empresa" className="text-xs text-muted-foreground">
              Empresa
            </Label>
            <Input
              id="empresa"
              name="empresa"
              required
              defaultValue={defaults.empresa}
              placeholder="Ex: Acme Ltda"
              list="empresas-mei"
              autoFocus
            />
            {empresas.length > 0 && (
              <datalist id="empresas-mei">
                {empresas.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            )}
          </div>

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
                placeholder="Ex: 3500,00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="data_emissao"
                className="text-xs text-muted-foreground"
              >
                Data de emissão
              </Label>
              <Input
                id="data_emissao"
                name="data_emissao"
                type="date"
                required
                defaultValue={defaults.data_emissao}
              />
            </div>
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

export function EditNotaMeiTrigger({
  nota,
  empresas,
}: {
  nota: NotaMeiRow;
  empresas?: string[];
}) {
  return (
    <NotaMeiFormDialog
      nota={nota}
      empresas={empresas}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
