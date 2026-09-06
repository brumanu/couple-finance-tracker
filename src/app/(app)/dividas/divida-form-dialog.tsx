"use client";

import { useMemo } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useFormDialog,
  type PropsDialogControlado,
} from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { createDivida, updateDivida, type DividaFormState } from "./actions";

export type DividaRow = {
  id: string;
  descricao: string;
  valor_total: number | string;
};

type Props = PropsDialogControlado & {
  divida?: DividaRow;
};

export function DividaFormDialog({ divida, trigger, defaultOpen, onClose }: Props) {
  const isEdit = Boolean(divida);

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

  const ctrl = useFormDialog<DividaFormState>({
    action: isEdit ? updateDivida.bind(null, divida!.id) : createDivida,
    sucesso: isEdit ? "Dívida atualizada." : "Dívida cadastrada.",
    defaultOpen,
    onClose,
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Nova dívida"
      titulo={isEdit ? "Editar dívida" : "Nova dívida"}
      descricao="Cadastre o total devido. Vai adicionando pagamentos parciais depois pra ir zerando."
    >
      <CampoForm htmlFor="descricao" rotulo="Descrição">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
          placeholder="Ex: Empréstimo com João, Cartão atrasado…"
        />
      </CampoForm>

      <CampoForm htmlFor="valor_total" rotulo="Valor total (R$)">
        <Input
          id="valor_total"
          name="valor_total"
          required
          inputMode="decimal"
          defaultValue={defaults.valor_total}
          placeholder="Ex: 2500,00"
        />
      </CampoForm>
    </FormDialogShell>
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
