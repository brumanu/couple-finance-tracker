"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import { NENHUM_QUEM, type MembroOpcao } from "@/lib/membros";
import { QuemGastouSelectField } from "@/components/quem-gastou-select";
import {
  createRecorrente,
  updateRecorrente,
  type RecorrenteFormState,
} from "./actions";

export type RecorrenteRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  quinzena: number;
  dia_vencimento: number | null;
  categoria: string | null;
  categoria_id: string | null;
  quem_gastou: string | null;
  ativa: boolean;
};

type Props = {
  recorrente?: RecorrenteRow;
  trigger?: React.ReactElement;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

const INITIAL_STATE: RecorrenteFormState = {};

export function RecorrenteFormDialog({
  recorrente,
  trigger,
  categorias = [],
  membros = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(recorrente);

  const action = isEdit
    ? updateRecorrente.bind(null, recorrente!.id)
    : createRecorrente;

  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      descricao: recorrente?.descricao ?? "",
      valor_previsto:
        recorrente?.valor_previsto != null
          ? Number(recorrente.valor_previsto).toFixed(2).replace(".", ",")
          : "",
      quinzena: String(recorrente?.quinzena ?? "15"),
      dia_vencimento:
        recorrente?.dia_vencimento != null
          ? String(recorrente.dia_vencimento)
          : "",
      categoriaId: recorrente?.categoria_id ?? NENHUMA_CATEGORIA,
      quemGastou: recorrente?.quem_gastou ?? NENHUM_QUEM,
      ativa: recorrente?.ativa ?? true,
    }),
    [
      recorrente?.id,
      recorrente?.descricao,
      recorrente?.valor_previsto,
      recorrente?.quinzena,
      recorrente?.dia_vencimento,
      recorrente?.categoria_id,
      recorrente?.quem_gastou,
      recorrente?.ativa,
    ],
  );

  const [categoriaId, setCategoriaId] = useState(defaults.categoriaId);
  useEffect(() => setCategoriaId(defaults.categoriaId), [defaults.categoriaId]);

  const [quemGastou, setQuemGastou] = useState(defaults.quemGastou);
  useEffect(() => setQuemGastou(defaults.quemGastou), [defaults.quemGastou]);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(isEdit ? "Conta atualizada." : "Conta cadastrada.");
      if (!isEdit) playCoinSound();
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
              <PlusIcon className="size-4" />
              Nova conta
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar conta recorrente" : "Nova conta recorrente"}
          </DialogTitle>
          <DialogDescription>
            Contas fixas que se repetem todo mês (aluguel, luz, internet…).
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
              placeholder="Ex: Aluguel"
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
              placeholder="Ex: 1500,00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quinzena">Quinzena de pagamento</Label>
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
              <Label htmlFor="dia_vencimento">Vence dia (opcional)</Label>
              <Input
                id="dia_vencimento"
                name="dia_vencimento"
                type="number"
                min={1}
                max={31}
                defaultValue={defaults.dia_vencimento}
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria_id">Categoria (opcional)</Label>
            <CategoriaSelectField
              categorias={categorias}
              value={categoriaId}
              onValueChange={setCategoriaId}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quem_gastou">Quem gastou (opcional)</Label>
            <QuemGastouSelectField
              membros={membros}
              value={quemGastou}
              onValueChange={setQuemGastou}
            />
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
              Conta ativa (entra no cálculo do dashboard)
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

export function EditRecorrenteTrigger({
  recorrente,
  categorias,
  membros,
}: {
  recorrente: RecorrenteRow;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
}) {
  return (
    <RecorrenteFormDialog
      recorrente={recorrente}
      categorias={categorias}
      membros={membros}
      trigger={
        <Button variant="ghost" size="sm" aria-label="Editar">
          <PencilIcon className="size-4" />
        </Button>
      }
    />
  );
}
