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
  createDespesa,
  updateDespesa,
  type DespesaFormState,
} from "./actions";

export type DespesaRow = {
  id: string;
  descricao: string;
  valor: number | string;
  data_pagamento: string;
  quinzena: number | null;
  categoria: string | null;
};

type Props = {
  despesa?: DespesaRow;
  trigger?: React.ReactElement;
};

const INITIAL_STATE: DespesaFormState = {};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function inferQuinzena(dateISO: string): "15" | "30" {
  const day = Number(dateISO.slice(8, 10));
  return day <= 15 ? "15" : "30";
}

export function DespesaFormDialog({ despesa, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(despesa);

  const action = isEdit
    ? updateDespesa.bind(null, despesa!.id)
    : createDespesa;

  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(() => {
    const data = despesa?.data_pagamento ?? todayISO();
    return {
      descricao: despesa?.descricao ?? "",
      valor:
        despesa?.valor != null
          ? Number(despesa.valor).toFixed(2).replace(".", ",")
          : "",
      data,
      quinzena: String(despesa?.quinzena ?? inferQuinzena(data)),
      categoria: despesa?.categoria ?? "",
    };
  }, [
    despesa?.id,
    despesa?.descricao,
    despesa?.valor,
    despesa?.data_pagamento,
    despesa?.quinzena,
    despesa?.categoria,
  ]);

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
            <Button size="sm">
              <PlusIcon className="size-4" />
              Nova despesa
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar despesa" : "Nova despesa"}
          </DialogTitle>
          <DialogDescription>
            Gastos do dia a dia (mercado, gasolina, restaurante…).
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              name="descricao"
              required
              defaultValue={defaults.descricao}
              placeholder="Ex: Mercado Extra"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                name="valor"
                required
                inputMode="decimal"
                defaultValue={defaults.valor}
                placeholder="Ex: 250,00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                name="data"
                type="date"
                required
                defaultValue={defaults.data}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quinzena">Quinzena</Label>
              <Select name="quinzena" defaultValue={defaults.quinzena}>
                <SelectTrigger id="quinzena">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Dia 15</SelectItem>
                  <SelectItem value="30">Dia 30</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria (opcional)</Label>
              <Input
                id="categoria"
                name="categoria"
                defaultValue={defaults.categoria}
                placeholder="Ex: mercado, lazer"
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
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditDespesaTrigger({ despesa }: { despesa: DespesaRow }) {
  return (
    <DespesaFormDialog
      despesa={despesa}
      trigger={
        <Button variant="ghost" size="sm" aria-label="Editar">
          <PencilIcon className="size-4" />
        </Button>
      }
    />
  );
}
