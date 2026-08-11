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
import { BancoIcone } from "@/lib/bancos-icones";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import {
  createDespesa,
  updateDespesa,
  type DespesaFormState,
} from "./actions";

export type DespesaRow = {
  id: string;
  descricao: string;
  valor: number | string;
  data_pagamento: string;
  quinzena: number | null;
  categoria: string | null;
};

type Props = {
  despesa?: DespesaRow;
  trigger?: React.ReactElement;
  cartoes?: CartaoOpcao[];
};

const INITIAL_STATE: DespesaFormState = {};

const NENHUM = "__nenhum__";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function inferQuinzena(dateISO: string): "15" | "30" {
  const day = Number(dateISO.slice(8, 10));
  return day <= 15 ? "15" : "30";
}

export function DespesaFormDialog({
  despesa,
  trigger,
  cartoes = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(despesa);

  const action = isEdit
    ? updateDespesa.bind(null, despesa!.id)
    : createDespesa;

  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(() => {
    const data = despesa?.data_pagamento ?? todayISO();
    return {
      descricao: despesa?.descricao ?? "",
      valor:
        despesa?.valor != null
          ? Number(despesa.valor).toFixed(2).replace(".", ",")
          : "",
      data,
      quinzena: String(despesa?.quinzena ?? inferQuinzena(data)),
      categoria: despesa?.categoria ?? "",
    };
  }, [
    despesa?.id,
    despesa?.descricao,
    despesa?.valor,
    despesa?.data_pagamento,
    despesa?.quinzena,
    despesa?.categoria,
  ]);

  const [cartaoId, setCartaoId] = useState<string>(NENHUM);
  const [parcelada, setParcelada] = useState(false);
  const [parcelasRaw, setParcelasRaw] = useState("2");

  useEffect(() => {
    // Ao (re)abrir para uma nova despesa, sempre começa sem cartão
    if (!isEdit) {
      setCartaoId(NENHUM);
      setParcelada(false);
      setParcelasRaw("2");
    }
  }, [isEdit, open]);

  // Se desmarca cartão, reseta o estado de parcelamento
  useEffect(() => {
    if (cartaoId === NENHUM) {
      setParcelada(false);
    }
  }, [cartaoId]);

  const usaCartao = cartaoId !== NENHUM;
  const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm">
              <PlusIcon className="size-4" strokeWidth={2.75} />
              Lançar despesa
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar despesa" : "Lançar despesa"}
          </DialogTitle>
          <DialogDescription>
            {usaCartao
              ? parcelada
                ? "Vira uma compra parcelada no cartão — cada parcela cai na fatura do mês certo."
                : "Vira uma compra à vista no cartão — some do saldo da quinzena e entra na próxima fatura."
              : "Mercado, gasolina, aquele jantar de sexta."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao" className="text-xs text-muted-foreground">
              Descrição
            </Label>
            <Input
              id="descricao"
              name="descricao"
              required
              defaultValue={defaults.descricao}
              placeholder="Ex: Mercado Extra"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valor" className="text-xs text-muted-foreground">
                Valor (R$)
              </Label>
              <Input
                id="valor"
                name="valor"
                required
                inputMode="decimal"
                defaultValue={defaults.valor}
                placeholder="Ex: 250,00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data" className="text-xs text-muted-foreground">
                Data
              </Label>
              <Input
                id="data"
                name="data"
                type="date"
                required
                defaultValue={defaults.data}
              />
            </div>
          </div>

          {!isEdit && cartoes.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="cartao_id"
                className="text-xs text-muted-foreground"
              >
                Cartão (opcional)
              </Label>
              <input type="hidden" name="cartao_id" value={usaCartao ? cartaoId : ""} />
              <input
                type="hidden"
                name="parcelas"
                value={usaCartao && parcelada ? parcelasRaw : "1"}
              />
              <Select
                value={cartaoId}
                onValueChange={(v) => v && setCartaoId(v)}
              >
                <SelectTrigger id="cartao_id">
                  <SelectValue>
                    {cartaoSelecionado ? (
                      <span className="inline-flex items-center gap-2">
                        <BancoIcone
                          icone={cartaoSelecionado.bancoIcone}
                          corFallback={cartaoSelecionado.bancoCor}
                          nomeFallback={cartaoSelecionado.bancoNome}
                          size={20}
                        />
                        <span>{cartaoSelecionado.label}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Sem cartão — despesa do dia a dia
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>
                    <span className="text-muted-foreground">
                      Sem cartão — despesa do dia a dia
                    </span>
                  </SelectItem>
                  {cartoes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <BancoIcone
                          icone={c.bancoIcone}
                          corFallback={c.bancoCor}
                          nomeFallback={c.bancoNome}
                          size={20}
                        />
                        <span>{c.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {usaCartao && (
                <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-border/60 p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={parcelada}
                      onChange={(e) => setParcelada(e.target.checked)}
                      className="size-4 rounded border-input"
                    />
                    Foi parcelada
                  </label>
                  {parcelada && (
                    <div className="flex items-center gap-2 pl-6">
                      <Label
                        htmlFor="parcelas_compra"
                        className="text-xs text-muted-foreground"
                      >
                        Em
                      </Label>
                      <Input
                        id="parcelas_compra"
                        type="number"
                        min={2}
                        max={60}
                        value={parcelasRaw}
                        onChange={(e) => setParcelasRaw(e.target.value)}
                        className="max-w-[100px]"
                      />
                      <span className="text-sm text-muted-foreground">
                        parcelas
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!usaCartao && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="quinzena"
                  className="text-xs text-muted-foreground"
                >
                  Quinzena
                </Label>
                <Select name="quinzena" defaultValue={defaults.quinzena}>
                  <SelectTrigger id="quinzena">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">Dia 15</SelectItem>
                    <SelectItem value="30">Dia 30</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="categoria"
                  className="text-xs text-muted-foreground"
                >
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
          )}

          {usaCartao && (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="categoria"
                className="text-xs text-muted-foreground"
              >
                Categoria (opcional)
              </Label>
              <Input
                id="categoria"
                name="categoria"
                defaultValue={defaults.categoria}
                placeholder="Ex: mercado, lazer"
              />
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
              {pending
                ? "Salvando…"
                : usaCartao
                  ? "Lançar no cartão"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditDespesaTrigger({ despesa }: { despesa: DespesaRow }) {
  return (
    <DespesaFormDialog
      despesa={despesa}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
