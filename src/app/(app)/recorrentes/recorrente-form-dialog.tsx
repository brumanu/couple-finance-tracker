"use client";

import { useMemo, useState } from "react";
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
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import { NENHUM_QUEM, type MembroOpcao } from "@/lib/membros";
import { QuemGastouSelectField } from "@/components/quem-gastou-select";
import {
  useFormDialog,
  type PropsDialogControlado,
} from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
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

type Props = PropsDialogControlado & {
  recorrente?: RecorrenteRow;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

export function RecorrenteFormDialog({
  recorrente,
  trigger,
  defaultOpen,
  onClose,
  categorias = [],
  membros = [],
}: Props) {
  const isEdit = Boolean(recorrente);

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
  const [quemGastou, setQuemGastou] = useState(defaults.quemGastou);

  const ctrl = useFormDialog<RecorrenteFormState>({
    action: isEdit
      ? updateRecorrente.bind(null, recorrente!.id)
      : createRecorrente,
    sucesso: isEdit ? "Conta atualizada." : "Conta cadastrada.",
    defaultOpen,
    onClose,
    aoSalvar: isEdit ? undefined : playCoinSound,
    reset: () => {
      setCategoriaId(defaults.categoriaId);
      setQuemGastou(defaults.quemGastou);
    },
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Nova conta"
      titulo={isEdit ? "Editar conta recorrente" : "Nova conta recorrente"}
      descricao="Contas fixas que se repetem todo mês (aluguel, luz, internet…)."
    >
      <CampoForm htmlFor="descricao" rotulo="Descrição">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
          placeholder="Ex: Aluguel"
        />
      </CampoForm>

      <CampoForm htmlFor="valor_previsto" rotulo="Valor previsto (R$)">
        <Input
          id="valor_previsto"
          name="valor_previsto"
          required
          inputMode="decimal"
          defaultValue={defaults.valor_previsto}
          placeholder="Ex: 1500,00"
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoForm htmlFor="quinzena" rotulo="Quinzena de pagamento">
          <Select name="quinzena" defaultValue={defaults.quinzena}>
            <SelectTrigger id="quinzena">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">Dia 15</SelectItem>
              <SelectItem value="30">Dia 30</SelectItem>
            </SelectContent>
          </Select>
        </CampoForm>

        <CampoForm htmlFor="dia_vencimento" rotulo="Vence dia (opcional)">
          <Input
            id="dia_vencimento"
            name="dia_vencimento"
            type="number"
            min={1}
            max={31}
            defaultValue={defaults.dia_vencimento}
            placeholder="Ex: 10"
          />
        </CampoForm>
      </div>

      <CampoForm htmlFor="categoria_id" rotulo="Categoria (opcional)">
        <CategoriaSelectField
          categorias={categorias}
          value={categoriaId}
          onValueChange={setCategoriaId}
        />
      </CampoForm>

      <CampoForm htmlFor="quem_gastou" rotulo="Quem gastou (opcional)">
        <QuemGastouSelectField
          membros={membros}
          value={quemGastou}
          onValueChange={setQuemGastou}
        />
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
          Conta ativa (entra no cálculo do dashboard)
        </Label>
      </div>
    </FormDialogShell>
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
