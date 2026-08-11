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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCartao, updateCartao, type CartaoFormState } from "./actions";

export type CartaoRow = {
  id: string;
  banco_id: string;
  apelido: string | null;
  bandeira: string | null;
  dia_fechamento: number;
  dia_vencimento: number;
  ativo: boolean;
};

export type BancoOption = {
  id: string;
  nome: string;
  cor: string;
};

type Props = {
  cartao?: CartaoRow;
  bancos: BancoOption[];
  trigger?: React.ReactElement;
};

const INITIAL_STATE: CartaoFormState = {};

const BANDEIRAS = [
  { value: "visa", label: "Visa" },
  { value: "master", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "Amex" },
  { value: "hipercard", label: "Hipercard" },
  { value: "outra", label: "Outra" },
];

export function CartaoFormDialog({ cartao, bancos, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(cartao);
  const action = isEdit ? updateCartao.bind(null, cartao!.id) : createCartao;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      banco_id: cartao?.banco_id ?? bancos[0]?.id ?? "",
      apelido: cartao?.apelido ?? "",
      bandeira: cartao?.bandeira ?? "visa",
      dia_fechamento: String(cartao?.dia_fechamento ?? "1"),
      dia_vencimento: String(cartao?.dia_vencimento ?? "10"),
      ativo: cartao?.ativo ?? true,
    }),
    [
      cartao?.id,
      cartao?.banco_id,
      cartao?.apelido,
      cartao?.bandeira,
      cartao?.dia_fechamento,
      cartao?.dia_vencimento,
      cartao?.ativo,
      bancos[0]?.id,
    ],
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  const semBanco = bancos.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm" disabled={semBanco}>
              <PlusIcon className="size-4" strokeWidth={2.75} />
              Novo cartão
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar cartão" : "Novo cartão"}
          </DialogTitle>
          <DialogDescription>
            Fechamento e vencimento definem em que fatura cada compra cai.
          </DialogDescription>
        </DialogHeader>

        {semBanco ? (
          <p className="text-sm text-muted-foreground">
            Você precisa cadastrar um banco antes de criar um cartão.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="banco_id" className="text-xs text-muted-foreground">
                Banco
              </Label>
              <Select name="banco_id" defaultValue={defaults.banco_id}>
                <SelectTrigger id="banco_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bancos.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ background: b.cor }}
                      />
                      {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="apelido"
                className="text-xs text-muted-foreground"
              >
                Apelido (opcional)
              </Label>
              <Input
                id="apelido"
                name="apelido"
                defaultValue={defaults.apelido}
                placeholder="Ex: Platinum, Black, Adicional…"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="bandeira"
                className="text-xs text-muted-foreground"
              >
                Bandeira
              </Label>
              <Select name="bandeira" defaultValue={defaults.bandeira}>
                <SelectTrigger id="bandeira">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANDEIRAS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="dia_fechamento"
                  className="text-xs text-muted-foreground"
                >
                  Fecha dia
                </Label>
                <Input
                  id="dia_fechamento"
                  name="dia_fechamento"
                  type="number"
                  min={1}
                  max={31}
                  required
                  defaultValue={defaults.dia_fechamento}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="dia_vencimento"
                  className="text-xs text-muted-foreground"
                >
                  Vence dia
                </Label>
                <Input
                  id="dia_vencimento"
                  name="dia_vencimento"
                  type="number"
                  min={1}
                  max={31}
                  required
                  defaultValue={defaults.dia_vencimento}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativo"
                name="ativo"
                defaultChecked={defaults.ativo}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="ativo" className="cursor-pointer">
                Cartão ativo (entra no cálculo do dashboard)
              </Label>
            </div>

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
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EditCartaoTrigger({
  cartao,
  bancos,
}: {
  cartao: CartaoRow;
  bancos: BancoOption[];
}) {
  return (
    <CartaoFormDialog
      cartao={cartao}
      bancos={bancos}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
