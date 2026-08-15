"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { PlusIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { playCoinSound } from "@/lib/sound";
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
import { hojeISO } from "@/lib/mes";
import { parseBRLInput } from "@/lib/format";
import { BancoIcone } from "@/lib/bancos-icones";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import { NENHUM_QUEM, type MembroOpcao } from "@/lib/membros";
import { QuemGastouSelectField } from "@/components/quem-gastou-select";
import {
  createDespesa,
  updateDespesa,
  type DespesaFormState,
} from "./actions";

export type DespesaRow = {
  id: string;
  descricao: string;
  valor: number | string;
  data_pagamento: string | null;
  data_referencia: string | null;
  quinzena: number | null;
  categoria: string | null;
  categoria_id: string | null;
  quem_gastou: string | null;
};

type Props = {
  despesa?: DespesaRow;
  trigger?: React.ReactElement;
  cartoes?: CartaoOpcao[];
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

const INITIAL_STATE: DespesaFormState = {};

const NENHUM = "__nenhum__";

const todayISO = hojeISO;

function inferQuinzena(dateISO: string): "15" | "30" {
  const day = Number(dateISO.slice(8, 10));
  return day <= 15 ? "15" : "30";
}

export function DespesaFormDialog({
  despesa,
  trigger,
  cartoes = [],
  categorias = [],
  membros = [],
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
      categoriaId: despesa?.categoria_id ?? NENHUMA_CATEGORIA,
      quemGastou: despesa?.quem_gastou ?? NENHUM_QUEM,
    };
  }, [
    despesa?.id,
    despesa?.descricao,
    despesa?.valor,
    despesa?.data_pagamento,
    despesa?.quinzena,
    despesa?.categoria_id,
    despesa?.quem_gastou,
  ]);

  const [cartaoId, setCartaoId] = useState<string>(NENHUM);
  const [parcelada, setParcelada] = useState(false);
  const [parcelasRaw, setParcelasRaw] = useState("2");
  const [categoriaId, setCategoriaId] = useState(defaults.categoriaId);
  const [quemGastou, setQuemGastou] = useState(defaults.quemGastou);
  const [dataValue, setDataValue] = useState(defaults.data);
  const [quinzena, setQuinzena] = useState(defaults.quinzena);
  const [quinzenaTouched, setQuinzenaTouched] = useState(false);
  const [valorRaw, setValorRaw] = useState(defaults.valor);

  useEffect(() => setValorRaw(defaults.valor), [defaults.valor]);

  const valorInvalido = useMemo(() => {
    if (!valorRaw.trim()) return false;
    const n = parseBRLInput(valorRaw);
    return n === null || n <= 0;
  }, [valorRaw]);

  useEffect(() => setCategoriaId(defaults.categoriaId), [defaults.categoriaId]);
  useEffect(() => setQuemGastou(defaults.quemGastou), [defaults.quemGastou]);

  useEffect(() => {
    if (!isEdit) {
      setCartaoId(NENHUM);
      setParcelada(false);
      setParcelasRaw("2");
    }
  }, [isEdit, open]);

  useEffect(() => {
    setDataValue(defaults.data);
    setQuinzena(defaults.quinzena);
    setQuinzenaTouched(false);
  }, [open, defaults.data, defaults.quinzena]);

  function handleDataChange(novaData: string) {
    setDataValue(novaData);
    if (!quinzenaTouched && novaData) {
      setQuinzena(inferQuinzena(novaData));
    }
  }

  useEffect(() => {
    if (cartaoId === NENHUM) {
      setParcelada(false);
    }
  }, [cartaoId]);

  const usaCartao = cartaoId !== NENHUM;
  const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(isEdit ? "Despesa atualizada." : "Despesa cadastrada.");
      if (!isEdit) playCoinSound();
    }
  }, [state, isEdit]);

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

        <form key={open ? "open" : "closed"} action={formAction} className="flex flex-col gap-4">
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
                aria-invalid={valorInvalido}
                value={valorRaw}
                onChange={(e) => setValorRaw(e.target.value)}
                placeholder="Ex: 250,00"
              />
              {valorInvalido && (
                <p className="text-xs text-destructive">
                  Digite um valor válido, ex: 250,00.
                </p>
              )}
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
                value={dataValue}
                onChange={(e) => handleDataChange(e.target.value)}
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
                <input type="hidden" name="quinzena" value={quinzena} />
                <Select
                  value={quinzena}
                  onValueChange={(v) => {
                    if (!v) return;
                    setQuinzenaTouched(true);
                    setQuinzena(v);
                  }}
                >
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
                  htmlFor="categoria_id"
                  className="text-xs text-muted-foreground"
                >
                  Categoria
                </Label>
                <CategoriaSelectField
                  categorias={categorias}
                  value={categoriaId}
                  onValueChange={setCategoriaId}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="quem_gastou"
                  className="text-xs text-muted-foreground"
                >
                  Quem gastou (opcional)
                </Label>
                <QuemGastouSelectField
                  membros={membros}
                  value={quemGastou}
                  onValueChange={setQuemGastou}
                />
              </div>
            </div>
          )}

          {usaCartao && (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="categoria_id"
                className="text-xs text-muted-foreground"
              >
                Categoria
              </Label>
              <CategoriaSelectField
                categorias={categorias}
                value={categoriaId}
                onValueChange={setCategoriaId}
              />
              <Label
                htmlFor="quem_gastou"
                className="text-xs text-muted-foreground"
              >
                Quem gastou (opcional)
              </Label>
              <QuemGastouSelectField
                membros={membros}
                value={quemGastou}
                onValueChange={setQuemGastou}
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

export function EditDespesaTrigger({
  despesa,
  categorias,
  membros,
}: {
  despesa: DespesaRow;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
}) {
  return (
    <DespesaFormDialog
      despesa={despesa}
      categorias={categorias}
      membros={membros}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
