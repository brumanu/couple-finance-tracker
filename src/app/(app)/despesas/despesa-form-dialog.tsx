"use client";

import { useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
import { playCoinSound } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hojeISO } from "@/lib/mes";
import { BancoIcone } from "@/lib/bancos-icones";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import { NENHUM_QUEM, type MembroOpcao } from "@/lib/membros";
import { QuemGastouSelectField } from "@/components/quem-gastou-select";
import {
  useFormDialog,
  type PropsDialogControlado,
} from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import {
  CampoData,
  CampoQuinzena,
  CampoValor,
  inferQuinzena,
  useValorDataQuinzena,
} from "@/components/campos-lancamento";
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

type Props = PropsDialogControlado & {
  despesa?: DespesaRow;
  cartoes?: CartaoOpcao[];
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

const NENHUM = "__nenhum__";

export function DespesaFormDialog({
  despesa,
  trigger,
  cartoes = [],
  categorias = [],
  membros = [],
  defaultOpen,
  onClose,
}: Props) {
  const isEdit = Boolean(despesa);

  const defaults = useMemo(() => {
    const data = despesa?.data_pagamento ?? hojeISO();
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

  const campos = useValorDataQuinzena(defaults);
  const [cartaoId, setCartaoId] = useState<string>(NENHUM);
  const [parcelada, setParcelada] = useState(false);
  const [parcelasRaw, setParcelasRaw] = useState("2");
  const [categoriaId, setCategoriaId] = useState(defaults.categoriaId);
  const [quemGastou, setQuemGastou] = useState(defaults.quemGastou);

  const ctrl = useFormDialog<DespesaFormState>({
    action: isEdit ? updateDespesa.bind(null, despesa!.id) : createDespesa,
    sucesso: isEdit ? "Despesa atualizada." : "Despesa cadastrada.",
    defaultOpen,
    onClose,
    aoSalvar: isEdit ? undefined : playCoinSound,
    reset: () => {
      campos.reset();
      setCategoriaId(defaults.categoriaId);
      setQuemGastou(defaults.quemGastou);
      // Cartão/parcelamento só existem no cadastro — na edição a despesa já
      // nasceu avulsa e não pode virar compra de cartão.
      if (!isEdit) {
        setCartaoId(NENHUM);
        setParcelada(false);
        setParcelasRaw("2");
      }
    },
  });

  function handleCartaoChange(novoCartao: string) {
    setCartaoId(novoCartao);
    // Sem cartão não existe parcelamento.
    if (novoCartao === NENHUM) setParcelada(false);
  }

  const usaCartao = cartaoId !== NENHUM;
  const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId);

  const camposClassificacao = (
    <>
      <CampoForm htmlFor="categoria_id" rotulo="Categoria">
        <CategoriaSelectField
          categorias={categorias}
          value={categoriaId}
          onValueChange={setCategoriaId}
        />
      </CampoForm>
      <CampoForm htmlFor="quem_gastou" rotulo="Quem gastou (opcional)">
        <QuemGastouSelectField
          membros={membros}
          value={quemGastou}
          onValueChange={setQuemGastou}
        />
      </CampoForm>
    </>
  );

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Lançar despesa"
      rotuloSalvar={usaCartao ? "Lançar no cartão" : "Salvar"}
      titulo={isEdit ? "Editar despesa" : "Lançar despesa"}
      descricao={
        usaCartao
          ? parcelada
            ? "Vira uma compra parcelada no cartão — cada parcela cai na fatura do mês certo."
            : "Vira uma compra à vista no cartão — some do saldo da quinzena e entra na próxima fatura."
          : "Mercado, gasolina, aquele jantar de sexta."
      }
    >
      <CampoForm htmlFor="descricao" rotulo="Descrição">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
          placeholder="Ex: Mercado Extra"
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoValor campos={campos} />
        <CampoData campos={campos} />
      </div>

      {!isEdit && cartoes.length > 0 && (
        <CampoForm htmlFor="cartao_id" rotulo="Cartão (opcional)">
          <input
            type="hidden"
            name="cartao_id"
            value={usaCartao ? cartaoId : ""}
          />
          <input
            type="hidden"
            name="parcelas"
            value={usaCartao && parcelada ? parcelasRaw : "1"}
          />
          <Select
            value={cartaoId}
            onValueChange={(v) => v && handleCartaoChange(v)}
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
                  <label
                    htmlFor="parcelas_compra"
                    className="text-xs text-muted-foreground"
                  >
                    Em
                  </label>
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
        </CampoForm>
      )}

      {usaCartao ? (
        <div className="flex flex-col gap-4">{camposClassificacao}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <CampoQuinzena campos={campos} />
          {camposClassificacao}
        </div>
      )}
    </FormDialogShell>
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
