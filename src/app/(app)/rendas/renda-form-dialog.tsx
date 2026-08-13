"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { PlusIcon, PencilIcon } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createRenda,
  updateRenda,
  type RendaFormState,
} from "./actions";

export type RendaRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  dia_recebimento: number;
  ativa: boolean;
};

type Props = {
  renda?: RendaRow;
  trigger?: React.ReactElement;
};

const INITIAL_STATE: RendaFormState = {};

export function RendaFormDialog({ renda, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(renda);

  const action = isEdit
    ? updateRenda.bind(null, renda!.id)
    : createRenda;

  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      descricao: renda?.descricao ?? "",
      valor_previsto:
        renda?.valor_previsto != null
          ? Number(renda.valor_previsto).toFixed(2).replace(".", ",")
          : "",
      dia_recebimento: String(renda?.dia_recebimento ?? "15"),
      ativa: renda?.ativa ?? true,
    }),
    [renda?.id, renda?.descricao, renda?.valor_previsto, renda?.dia_recebimento, renda?.ativa],
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm">
              <PlusIcon className="size-4" />
              Nova renda
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar renda" : "Nova renda"}</DialogTitle>
          <DialogDescription>
            Cadastre uma renda que entra na quinzena do dia 15 ou do dia 30.
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
              placeholder="Ex: Salário Esposa"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="valor_previsto">Valor previsto (R$)</Label>
            <Input
              id="valor_previsto"
              name="valor_previsto"
              required
              inputMode="decimal"
              defaultValue={defaults.valor_previsto}
              placeholder="Ex: 3200,00"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dia_recebimento">Dia de recebimento</Label>
            <Select name="dia_recebimento" defaultValue={defaults.dia_recebimento}>
              <SelectTrigger id="dia_recebimento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Dia 15 (adiantamento)</SelectItem>
                <SelectItem value="30">Dia 30 (salário final)</SelectItem>
              </SelectContent>
            </Select>
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
              Renda ativa (entra no cálculo do dashboard)
            </Label>
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
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditRendaTrigger({ renda }: { renda: RendaRow }) {
  return (
    <RendaFormDialog
      renda={renda}
      trigger={
        <Button variant="ghost" size="sm" aria-label="Editar">
          <PencilIcon className="size-4" />
        </Button>
      }
    />
  );
}
