"use client";

import { useMemo } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hojeISO } from "@/lib/mes";
import { useFormDialog, type PropsDialogControlado } from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { pagarContaRecorrente, type PagarFormState } from "./actions";

type Props = PropsDialogControlado & {
  contaRecorrenteId: string;
  descricao: string;
  valorPrevisto: number | string;
  dataReferencia: string; // YYYY-MM-01
  quinzena: 15 | 30;
};

export function PagarDialog({
  contaRecorrenteId,
  descricao,
  valorPrevisto,
  dataReferencia,
  quinzena,
  trigger,
  defaultOpen,
  onClose,
}: Props) {
  const defaults = useMemo(
    () => ({
      valor: Number(valorPrevisto).toFixed(2).replace(".", ","),
      dataHoje: hojeISO(),
      descricao,
    }),
    [valorPrevisto, descricao],
  );

  const ctrl = useFormDialog<PagarFormState>({
    action: pagarContaRecorrente.bind(
      null,
      contaRecorrenteId,
      dataReferencia,
      quinzena,
    ),
    sucesso: "Pagamento confirmado.",
    defaultOpen,
    onClose,
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      rotuloSalvar="Confirmar pagamento"
      titulo={`Marcar ${descricao} como paga`}
      descricao="Registre o valor real pago. Se veio diferente do previsto, ajuste aqui."
      trigger={
        // O provider/botão sob demanda passa o seu; sem isso, o botão daqui.
        trigger !== undefined ? (
          trigger
        ) : (
          <Button size="sm" variant="outline" title="Marcar como paga">
            <CheckIcon className="size-3.5" />
            Pagar
          </Button>
        )
      }
    >
      <CampoForm htmlFor="descricao" rotulo="Descrição">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoForm htmlFor="valor" rotulo="Valor pago (R$)">
          <Input
            id="valor"
            name="valor"
            required
            inputMode="decimal"
            defaultValue={defaults.valor}
          />
        </CampoForm>
        <CampoForm htmlFor="data_pagamento" rotulo="Data">
          <Input
            id="data_pagamento"
            name="data_pagamento"
            type="date"
            defaultValue={defaults.dataHoje}
          />
        </CampoForm>
      </div>
    </FormDialogShell>
  );
}
