"use client";

import { useMemo } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hojeISO } from "@/lib/mes";
import { useFormDialog, type PropsDialogControlado } from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { pagarFatura, type PagarFormState } from "./actions";

type Props = PropsDialogControlado & {
  cartaoId: string;
  /** Rótulo do cartão, ex: "C6 Bank · Jacqueline". */
  label: string;
  totalFatura: number;
  /** Primeiro dia do mês da fatura (YYYY-MM-01). */
  mesReferencia: string;
};

export function PagarFaturaDialog({
  cartaoId,
  label,
  totalFatura,
  mesReferencia,
  trigger,
  defaultOpen,
  onClose,
}: Props) {
  const defaults = useMemo(
    () => ({
      valor: totalFatura.toFixed(2).replace(".", ","),
      dataHoje: hojeISO(),
    }),
    [totalFatura],
  );

  const ctrl = useFormDialog<PagarFormState>({
    action: pagarFatura.bind(null, cartaoId, mesReferencia),
    sucesso: "Fatura marcada como paga.",
    defaultOpen,
    onClose,
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      rotuloSalvar="Confirmar pagamento"
      titulo={`Marcar fatura ${label} como paga`}
      descricao="Registre o valor real pago. As compras do cartão continuam intactas — isto só marca a fatura como quitada."
      trigger={
        // O provider/botão sob demanda passa o seu; sem isso, o botão daqui.
        trigger !== undefined ? (
          trigger
        ) : (
          <Button size="sm" variant="outline" title="Marcar fatura como paga">
            <CheckIcon className="size-3.5" />
            Pagar
          </Button>
        )
      }
    >
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
