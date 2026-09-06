"use client";

import { useMemo } from "react";
import { PencilIcon } from "lucide-react";
import { playCoinSound } from "@/lib/sound";
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
  useFormDialog,
  type PropsDialogControlado,
} from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { createRenda, updateRenda, type RendaFormState } from "./actions";

export type RendaRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  dia_recebimento: number;
  ativa: boolean;
};

type Props = PropsDialogControlado & {
  renda?: RendaRow;
};

export function RendaFormDialog({ renda, trigger, defaultOpen, onClose }: Props) {
  const isEdit = Boolean(renda);

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
    [
      renda?.id,
      renda?.descricao,
      renda?.valor_previsto,
      renda?.dia_recebimento,
      renda?.ativa,
    ],
  );

  const ctrl = useFormDialog<RendaFormState>({
    action: isEdit ? updateRenda.bind(null, renda!.id) : createRenda,
    sucesso: isEdit ? "Renda atualizada." : "Renda cadastrada.",
    defaultOpen,
    onClose,
    aoSalvar: isEdit ? undefined : playCoinSound,
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Nova renda"
      titulo={isEdit ? "Editar renda" : "Nova renda"}
      descricao="Cadastre uma renda que entra na quinzena do dia 15 ou do dia 30."
    >
      <CampoForm htmlFor="descricao" rotulo="Descrição">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
          placeholder="Ex: Salário Esposa"
        />
      </CampoForm>

      <CampoForm htmlFor="valor_previsto" rotulo="Valor previsto (R$)">
        <Input
          id="valor_previsto"
          name="valor_previsto"
          required
          inputMode="decimal"
          defaultValue={defaults.valor_previsto}
          placeholder="Ex: 3200,00"
        />
      </CampoForm>

      <CampoForm htmlFor="dia_recebimento" rotulo="Dia de recebimento">
        <Select name="dia_recebimento" defaultValue={defaults.dia_recebimento}>
          <SelectTrigger id="dia_recebimento">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">Dia 15 (adiantamento)</SelectItem>
            <SelectItem value="30">Dia 30 (salário final)</SelectItem>
          </SelectContent>
        </Select>
      </CampoForm>

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
    </FormDialogShell>
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
