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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hojeISO } from "@/lib/mes";
import { parseBRLInput } from "@/lib/format";
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import { useResetAoAbrir } from "@/lib/form-dialog";
import {
  createRendaExtra,
  updateRendaExtra,
  type RendaExtraFormState,
} from "./renda-extra-actions";

export type RendaExtraRow = {
  id: string;
  descricao: string;
  valor: number | string;
  data_pagamento: string | null;
  data_referencia: string | null;
  quinzena: number | null;
  categoria: string | null;
  categoria_id: string | null;
};

type Props = {
  rendaExtra?: RendaExtraRow;
  trigger?: React.ReactElement;
  categorias?: CategoriaOpcao[];
};

const INITIAL_STATE: RendaExtraFormState = {};

const todayISO = hojeISO;

function inferQuinzena(dateISO: string): "15" | "30" {
  const day = Number(dateISO.slice(8, 10));
  return day <= 15 ? "15" : "30";
}

export function RendaExtraFormDialog({
  rendaExtra,
  trigger,
  categorias = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(rendaExtra);

  const action = isEdit
    ? updateRendaExtra.bind(null, rendaExtra!.id)
    : createRendaExtra;

  // Fecha/notifica dentro da própria action em vez de um useEffect que
  // observa `state`: aqui já estamos numa transição, não num efeito pós-render.
  const [state, formAction, pending] = useActionState(
    async (prev: RendaExtraFormState, formData: FormData) => {
      const resultado = await action(prev, formData);
      if (resultado.ok) {
        setOpen(false);
        toast.success(isEdit ? "Renda extra atualizada." : "Renda extra cadastrada.");
        if (!isEdit) playCoinSound();
      }
      return resultado;
    },
    INITIAL_STATE,
  );

  const defaults = useMemo(() => {
    const data = rendaExtra?.data_pagamento ?? todayISO();
    return {
      descricao: rendaExtra?.descricao ?? "",
      valor:
        rendaExtra?.valor != null
          ? Number(rendaExtra.valor).toFixed(2).replace(".", ",")
          : "",
      data,
      quinzena: String(rendaExtra?.quinzena ?? inferQuinzena(data)),
      categoriaId: rendaExtra?.categoria_id ?? NENHUMA_CATEGORIA,
    };
  }, [
    rendaExtra?.id,
    rendaExtra?.descricao,
    rendaExtra?.valor,
    rendaExtra?.data_pagamento,
    rendaExtra?.quinzena,
    rendaExtra?.categoria_id,
  ]);

  const [categoriaId, setCategoriaId] = useState(defaults.categoriaId);
  const [dataValue, setDataValue] = useState(defaults.data);
  const [quinzena, setQuinzena] = useState(defaults.quinzena);
  const [quinzenaTouched, setQuinzenaTouched] = useState(false);
  const [valorRaw, setValorRaw] = useState(defaults.valor);

  const valorInvalido = useMemo(() => {
    if (!valorRaw.trim()) return false;
    const n = parseBRLInput(valorRaw);
    return n === null || n <= 0;
  }, [valorRaw]);

  useResetAoAbrir(open, () => {
    setValorRaw(defaults.valor);
    setCategoriaId(defaults.categoriaId);
    setDataValue(defaults.data);
    setQuinzena(defaults.quinzena);
    setQuinzenaTouched(false);
  });

  function handleDataChange(novaData: string) {
    setDataValue(novaData);
    if (!quinzenaTouched && novaData) {
      setQuinzena(inferQuinzena(novaData));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm">
              <PlusIcon className="size-4" strokeWidth={2.75} />
              Renda extra
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar renda extra" : "Renda extra"}
          </DialogTitle>
          <DialogDescription>
            Uma entrada pontual — vendeu algo, recebeu um extra — que vale só
            pra esse mês, sem se repetir.
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
              placeholder="Ex: Venda do sofá"
            />
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
                aria-invalid={valorInvalido}
                value={valorRaw}
                onChange={(e) => setValorRaw(e.target.value)}
                placeholder="Ex: 250,00"
              />
              {valorInvalido && (
                <p className="text-xs text-destructive">
                  Digite um valor válido, ex: 250,00.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data" className="text-xs text-muted-foreground">
                Data
              </Label>
              <Input
                id="data"
                name="data"
                type="date"
                required
                value={dataValue}
                onChange={(e) => handleDataChange(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quinzena" className="text-xs text-muted-foreground">
                Quinzena
              </Label>
              <input type="hidden" name="quinzena" value={quinzena} />
              <Select
                value={quinzena}
                onValueChange={(v) => {
                  if (!v) return;
                  setQuinzenaTouched(true);
                  setQuinzena(v);
                }}
              >
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
              <Label
                htmlFor="categoria_id"
                className="text-xs text-muted-foreground"
              >
                Categoria (opcional)
              </Label>
              <CategoriaSelectField
                categorias={categorias}
                value={categoriaId}
                onValueChange={setCategoriaId}
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

export function EditRendaExtraTrigger({
  rendaExtra,
  categorias,
}: {
  rendaExtra: RendaExtraRow;
  categorias?: CategoriaOpcao[];
}) {
  return (
    <RendaExtraFormDialog
      rendaExtra={rendaExtra}
      categorias={categorias}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
