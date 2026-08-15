"use client";

import { useActionState, useMemo, useState } from "react";
import { PlusIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
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
import { BancoIcone } from "@/lib/bancos-icones";
import { useResetAoAbrir } from "@/lib/form-dialog";
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
  icone: string | null;
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
  // Fecha/notifica dentro da própria action em vez de um useEffect que
  // observa `state`: aqui já estamos numa transição, não num efeito pós-render.
  const [state, formAction, pending] = useActionState(
    async (prev: CartaoFormState, formData: FormData) => {
      const resultado = await action(prev, formData);
      if (resultado.ok) {
        setOpen(false);
        toast.success(isEdit ? "Cartão atualizado." : "Cartão cadastrado.");
      }
      return resultado;
    },
    INITIAL_STATE,
  );

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

  const [bancoId, setBancoId] = useState(defaults.banco_id);
  useResetAoAbrir(open, () => setBancoId(defaults.banco_id));

  const semBanco = bancos.length === 0;
  const bancoSelecionado = bancos.find((b) => b.id === bancoId);

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
          <form key={open ? "open" : "closed"} action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="banco_id" value={bancoId} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="banco_id" className="text-xs text-muted-foreground">
                Banco
              </Label>
              <Select
                value={bancoId}
                onValueChange={(v) => v && setBancoId(v)}
              >
                <SelectTrigger id="banco_id">
                  <SelectValue>
                    {bancoSelecionado ? (
                      <span className="inline-flex items-center gap-2">
                        <BancoIcone
                          icone={bancoSelecionado.icone}
                          corFallback={bancoSelecionado.cor}
                          nomeFallback={bancoSelecionado.nome}
                          size={20}
                        />
                        <span>{bancoSelecionado.nome}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Selecione um banco
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {bancos.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="inline-flex items-center gap-2">
                        <BancoIcone
                          icone={b.icone}
                          corFallback={b.cor}
                          nomeFallback={b.nome}
                          size={20}
                        />
                        <span>{b.nome}</span>
                      </span>
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
