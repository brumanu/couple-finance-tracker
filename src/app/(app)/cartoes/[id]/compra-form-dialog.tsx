"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { PlusIcon, PencilIcon } from "lucide-react";
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
import { formatBRL, parseBRLInput } from "@/lib/format";
import {
  mesPrimeiraParcela,
  valoresParcelas,
} from "@/lib/cartao-calc";
import {
  createCompra,
  updateCompra,
  type CompraFormState,
} from "./actions";

export type CompraRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  categoria: string | null;
};

type Props = {
  cartaoId: string;
  diaFechamento: number;
  compra?: CompraRow;
  trigger?: React.ReactElement;
};

const INITIAL_STATE: CompraFormState = {};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CompraFormDialog({
  cartaoId,
  diaFechamento,
  compra,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(compra);
  const action = isEdit ? updateCompra.bind(null, compra!.id) : createCompra;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      descricao: compra?.descricao ?? "",
      valor_total:
        compra?.valor_total != null
          ? Number(compra.valor_total).toFixed(2).replace(".", ",")
          : "",
      data_compra: compra?.data_compra ?? todayISO(),
      parcelas: String(compra?.parcelas ?? 1),
      categoria: compra?.categoria ?? "",
    }),
    [
      compra?.id,
      compra?.descricao,
      compra?.valor_total,
      compra?.data_compra,
      compra?.parcelas,
      compra?.categoria,
    ],
  );

  // Estados controlados só pra montar o preview
  const [valorRaw, setValorRaw] = useState(defaults.valor_total);
  const [dataRaw, setDataRaw] = useState(defaults.data_compra);
  const [parcelasRaw, setParcelasRaw] = useState(defaults.parcelas);
  useEffect(() => setValorRaw(defaults.valor_total), [defaults.valor_total]);
  useEffect(() => setDataRaw(defaults.data_compra), [defaults.data_compra]);
  useEffect(() => setParcelasRaw(defaults.parcelas), [defaults.parcelas]);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  const preview = useMemo(() => {
    const total = parseBRLInput(valorRaw);
    const parcelas = Number(parcelasRaw);
    if (
      total === null ||
      total <= 0 ||
      !Number.isFinite(parcelas) ||
      parcelas < 1 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dataRaw)
    )
      return null;

    const valores = valoresParcelas(total, parcelas);
    const primeira = mesPrimeiraParcela(dataRaw, diaFechamento);
    const totalMesesUltima = primeira.mes + parcelas - 1;
    const anoUltima = primeira.ano + Math.floor((totalMesesUltima - 1) / 12);
    const mesUltima = ((totalMesesUltima - 1) % 12) + 1;

    return {
      valorParcela: valores[0],
      primeiraLabel: primeira.label,
      ultimaLabel: `${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][mesUltima-1]} ${anoUltima}`,
      parcelas,
    };
  }, [valorRaw, parcelasRaw, dataRaw, diaFechamento]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm">
              <PlusIcon className="size-4" strokeWidth={2.75} />
              Nova compra
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar compra" : "Nova compra no cartão"}
          </DialogTitle>
          <DialogDescription>
            Se for parcelada, o sistema distribui pelos meses a partir da
            data da compra e do fechamento do cartão.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="cartao_id" value={cartaoId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao" className="text-xs text-muted-foreground">
              Descrição
            </Label>
            <Input
              id="descricao"
              name="descricao"
              required
              defaultValue={defaults.descricao}
              placeholder="Ex: iPhone, Amazon, Mercado"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor_total" className="text-xs text-muted-foreground">
                Valor total (R$)
              </Label>
              <Input
                id="valor_total"
                name="valor_total"
                required
                inputMode="decimal"
                value={valorRaw}
                onChange={(e) => setValorRaw(e.target.value)}
                placeholder="Ex: 1200,00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_compra" className="text-xs text-muted-foreground">
                Data da compra
              </Label>
              <Input
                id="data_compra"
                name="data_compra"
                type="date"
                required
                value={dataRaw}
                onChange={(e) => setDataRaw(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="parcelas" className="text-xs text-muted-foreground">
                Parcelas
              </Label>
              <Input
                id="parcelas"
                name="parcelas"
                type="number"
                min={1}
                max={60}
                required
                value={parcelasRaw}
                onChange={(e) => setParcelasRaw(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria" className="text-xs text-muted-foreground">
                Categoria (opcional)
              </Label>
              <Input
                id="categoria"
                name="categoria"
                defaultValue={defaults.categoria}
                placeholder="Ex: mercado, lazer"
              />
            </div>
          </div>

          {preview && (
            <div className="rounded-2xl border border-border/60 bg-neutral-100 p-4">
              {preview.parcelas === 1 ? (
                <p className="text-sm">
                  Cai integralmente na fatura de{" "}
                  <strong>{preview.primeiraLabel}</strong>.
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    <strong>{preview.parcelas}x</strong> de{" "}
                    <strong className="tabular-nums">
                      {formatBRL(preview.valorParcela)}
                    </strong>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    De {preview.primeiraLabel} até {preview.ultimaLabel}
                  </p>
                </>
              )}
            </div>
          )}

          {state.error && (
            <p className="text-sm text-primary" role="alert">
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

export function EditCompraTrigger({
  compra,
  diaFechamento,
}: {
  compra: CompraRow;
  diaFechamento: number;
}) {
  return (
    <CompraFormDialog
      cartaoId={compra.cartao_id}
      diaFechamento={diaFechamento}
      compra={compra}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
