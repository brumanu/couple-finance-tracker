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
import { chaveDoMes, mesAtual } from "@/lib/mes";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { createRenda, updateRenda, type RendaFormState } from "./actions";

export type RendaRow = {
  id: string;
  descricao: string;
  valor_previsto: number | string;
  dia_recebimento: number;
  inicio_vigencia: string;
  fim_vigencia: string | null;
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
      // Renda nova começa a valer no mês corrente; sem isso ela voltaria a
      // reescrever todo o histórico, que é justamente o que a vigência evita.
      inicio_vigencia: renda?.inicio_vigencia
        ? chaveDoMes(renda.inicio_vigencia)
        : mesAtual().chave,
      fim_vigencia: renda?.fim_vigencia ? chaveDoMes(renda.fim_vigencia) : "",
      ativa: renda?.ativa ?? true,
    }),
    [
      renda?.id,
      renda?.descricao,
      renda?.valor_previsto,
      renda?.dia_recebimento,
      renda?.inicio_vigencia,
      renda?.fim_vigencia,
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
      descricao="Cadastre uma renda que entra na quinzena do dia 15 ou do dia 30, a partir do mês em que ela começa."
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

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoForm htmlFor="inicio_vigencia" rotulo="Vale a partir de">
          <Input
            id="inicio_vigencia"
            name="inicio_vigencia"
            type="month"
            required
            defaultValue={defaults.inicio_vigencia}
          />
        </CampoForm>

        <CampoForm htmlFor="fim_vigencia" rotulo="Encerra em (opcional)">
          <Input
            id="fim_vigencia"
            name="fim_vigencia"
            type="month"
            defaultValue={defaults.fim_vigencia}
          />
        </CampoForm>
      </div>
      <p className="-mt-1 text-[13px] text-muted-foreground">
        A renda só entra nos meses dentro desse período. Deixe o fim em branco
        enquanto ela não tiver data para acabar.
      </p>

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
