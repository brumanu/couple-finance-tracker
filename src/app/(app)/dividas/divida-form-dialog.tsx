"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { PlusIcon, PencilIcon } from "lucide-react";
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
import { createDivida, updateDivida, type DividaFormState } from "./actions";

export type DividaRow = {
  id: string;
  descricao: string;
  valor_total: number | string;
};

type Props = {
  divida?: DividaRow;
  trigger?: React.ReactElement;
};

const INITIAL_STATE: DividaFormState = {};

export function DividaFormDialog({ divida, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(divida);
  const action = isEdit ? updateDivida.bind(null, divida!.id) : createDivida;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      descricao: divida?.descricao ?? "",
      valor_total:
        divida?.valor_total != null
          ? Number(divida.valor_total).toFixed(2).replace(".", ",")
          : "",
    }),
    [divida?.id, divida?.descricao, divida?.valor_total],
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(isEdit ? "Dívida atualizada." : "Dívida cadastrada.");
    }
  }, [state, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm">
              <PlusIcon className="size-4" strokeWidth={2.75} />
              Nova dívida
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar dívida" : "Nova dívida"}
          </DialogTitle>
          <DialogDescription>
            Cadastre o total devido. Vai adicionando pagamentos parciais
            depois pra ir zerando.
          </DialogDescription>
        </DialogHeader>

        <form key={open ? "open" : "closed"} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao" className="text-xs text-muted-foreground">
              Descrição
            </Label>
            <Input
              id="descricao"
              name="descricao"
              required
              defaultValue={defaults.descricao}
              placeholder="Ex: Empréstimo com João, Cartão atrasado…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="valor_total" className="text-xs text-muted-foreground">
              Valor total (R$)
            </Label>
            <Input
              id="valor_total"
              name="valor_total"
              required
              inputMode="decimal"
              defaultValue={defaults.valor_total}
              placeholder="Ex: 2500,00"
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
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditDividaTrigger({ divida }: { divida: DividaRow }) {
  return (
    <DividaFormDialog
      divida={divida}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
