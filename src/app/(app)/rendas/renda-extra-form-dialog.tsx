"use client";

import { useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
import { playCoinSound } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hojeISO } from "@/lib/mes";
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import {
  useFormDialog,
  type PropsDialogControlado,
} from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import {
  CampoData,
  CampoQuinzena,
  CampoValor,
  inferQuinzena,
  useValorDataQuinzena,
} from "@/components/campos-lancamento";
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

type Props = PropsDialogControlado & {
  rendaExtra?: RendaExtraRow;
  categorias?: CategoriaOpcao[];
};

export function RendaExtraFormDialog({
  rendaExtra,
  trigger,
  defaultOpen,
  onClose,
  categorias = [],
}: Props) {
  const isEdit = Boolean(rendaExtra);

  const defaults = useMemo(() => {
    const data = rendaExtra?.data_pagamento ?? hojeISO();
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

  const campos = useValorDataQuinzena(defaults);
  const [categoriaId, setCategoriaId] = useState(defaults.categoriaId);

  const ctrl = useFormDialog<RendaExtraFormState>({
    action: isEdit
      ? updateRendaExtra.bind(null, rendaExtra!.id)
      : createRendaExtra,
    sucesso: isEdit ? "Renda extra atualizada." : "Renda extra cadastrada.",
    defaultOpen,
    onClose,
    aoSalvar: isEdit ? undefined : playCoinSound,
    reset: () => {
      campos.reset();
      setCategoriaId(defaults.categoriaId);
    },
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Renda extra"
      titulo={isEdit ? "Editar renda extra" : "Renda extra"}
      descricao="Uma entrada pontual — vendeu algo, recebeu um extra — que vale só pra esse mês, sem se repetir."
    >
      <CampoForm htmlFor="descricao" rotulo="Descrição">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
          placeholder="Ex: Venda do sofá"
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoValor campos={campos} />
        <CampoData campos={campos} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CampoQuinzena campos={campos} />
        <CampoForm htmlFor="categoria_id" rotulo="Categoria (opcional)">
          <CategoriaSelectField
            categorias={categorias}
            value={categoriaId}
            onValueChange={setCategoriaId}
          />
        </CampoForm>
      </div>
    </FormDialogShell>
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
