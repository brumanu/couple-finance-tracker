"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import { hojeISO } from "@/lib/mes";
import { useFormDialog, type PropsDialogControlado } from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { createPagamento, type PagamentoDividaFormState } from "./actions";

type Props = PropsDialogControlado & {
  dividaId: string;
  restante: number;
};

export function PagamentoFormDialog({
  dividaId,
  restante,
  trigger,
  defaultOpen,
  onClose,
}: Props) {
  const defaults = useMemo(
    () => ({
      valor: restante > 0 ? Number(restante).toFixed(2).replace(".", ",") : "",
      data: hojeISO(),
    }),
    [restante],
  );

  const ctrl = useFormDialog<PagamentoDividaFormState>({
    action: createPagamento,
    sucesso: "Pagamento registrado.",
    defaultOpen,
    onClose,
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Novo pagamento"
      rotuloSalvar="Registrar"
      titulo="Registrar pagamento"
      descricao={`Falta pagar ${formatBRL(restante)}. Pode ser qualquer valor até esse total.`}
    >
      <input type="hidden" name="divida_id" value={dividaId} />

      <div className="grid grid-cols-2 gap-3">
        <CampoForm htmlFor="valor" rotulo="Valor (R$)">
          <Input
            id="valor"
            name="valor"
            required
            inputMode="decimal"
            defaultValue={defaults.valor}
            placeholder="Ex: 300,00"
          />
        </CampoForm>
        <CampoForm htmlFor="data_pagamento" rotulo="Data">
          <Input
            id="data_pagamento"
            name="data_pagamento"
            type="date"
            required
            defaultValue={defaults.data}
          />
        </CampoForm>
      </div>

      <CampoForm htmlFor="observacao" rotulo="Observação (opcional)">
        <Input
          id="observacao"
          name="observacao"
          placeholder="Ex: transferido pelo Pix"
        />
      </CampoForm>
    </FormDialogShell>
  );
}
