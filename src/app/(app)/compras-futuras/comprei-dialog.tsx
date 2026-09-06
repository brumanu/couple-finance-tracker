"use client";

import { useMemo, useState } from "react";
import { CheckIcon } from "lucide-react";
import { playCoinSound } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hojeISO } from "@/lib/mes";
import { useFormDialog, type PropsDialogControlado } from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { marcarComprada, type CompraFuturaFormState } from "./actions";

type Props = PropsDialogControlado & {
  id: string;
  descricao: string;
  valorEstimado: number | null;
};

export function CompreiDialog({
  id,
  descricao,
  valorEstimado,
  trigger,
  defaultOpen,
  onClose,
}: Props) {
  const [lancar, setLancar] = useState(true);

  const defaults = useMemo(
    () => ({
      valor:
        valorEstimado != null ? valorEstimado.toFixed(2).replace(".", ",") : "",
      hoje: hojeISO(),
    }),
    [valorEstimado],
  );

  const ctrl = useFormDialog<CompraFuturaFormState>({
    action: marcarComprada.bind(null, id),
    sucesso: "Marcado como comprado.",
    defaultOpen,
    onClose,
    aoSalvar: playCoinSound,
    reset: () => setLancar(true),
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      rotuloSalvar="Confirmar"
      titulo={`Comprei “${descricao}”`}
      descricao="O item sai da lista de desejos. Se quiser, já lanço a despesa junto — categoria e quem quer vêm do próprio item."
      trigger={
        // O provider/botão sob demanda passa o seu; sem isso, o botão daqui.
        trigger !== undefined ? (
          trigger
        ) : (
          <Button size="sm" variant="outline" title="Marcar como comprado">
            <CheckIcon className="size-3.5" />
            Comprei
          </Button>
        )
      }
    >
      <CampoForm htmlFor="data_compra" rotulo="Data da compra">
        <Input
          id="data_compra"
          name="data_compra"
          type="date"
          defaultValue={defaults.hoje}
        />
      </CampoForm>

      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="lancar_despesa"
            checked={lancar}
            onChange={(e) => setLancar(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Lançar como despesa
        </label>
        {lancar && (
          <div className="flex flex-col gap-2 pl-6 pt-1">
            <Label htmlFor="valor" className="text-xs text-muted-foreground">
              Valor pago (R$)
            </Label>
            <Input
              id="valor"
              name="valor"
              required
              inputMode="decimal"
              defaultValue={defaults.valor}
              placeholder="Ex: 2500,00"
              className="max-w-[180px]"
            />
            <p className="text-xs text-muted-foreground">
              Cria uma despesa avulsa. Se foi no cartão, deixe desmarcado e
              cadastre a compra pelo cartão.
            </p>
          </div>
        )}
      </div>
    </FormDialogShell>
  );
}
