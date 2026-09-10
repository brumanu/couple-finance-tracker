"use client";

import { useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
import { playCoinSound } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, parseBRLInput } from "@/lib/format";
import {
  mesDaParcela,
  mesPrimeiraParcela,
  valoresParcelas,
} from "@/lib/cartao-calc";
import { hojeISO } from "@/lib/mes";
import type { CategoriaOpcao } from "@/lib/categorias";
import { CategoriasComPrincipal } from "@/components/categorias-com-principal";
import {
  selecaoDaLinha,
  type ExtraDeCategoria,
  type SelecaoCategorias,
} from "@/lib/categorias-extras";
import { NENHUM_QUEM, type MembroOpcao } from "@/lib/membros";
import { QuemGastouSelectField } from "@/components/quem-gastou-select";
import {
  useFormDialog,
  type PropsDialogControlado,
} from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { createCompra, updateCompra, type CompraFormState } from "./actions";

export type CompraRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_total: number | string;
  data_compra: string;
  parcelas: number;
  parcelas_ja_pagas: number | null;
  categoria: string | null;
  categoria_id: string | null;
  /** Categorias adicionais (migration 0017) — vêm embutidas no select. */
  categorias_extras?: ExtraDeCategoria[] | null;
  quem_gastou: string | null;
};

type Props = PropsDialogControlado & {
  cartaoId: string;
  diaFechamento: number;
  diaVencimento: number;
  compra?: CompraRow;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

const MESES_PT_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// Se o usuário marcar "compra em andamento" com parcela atual X, a
// primeira parcela ativa (X) deve cair no mês corrente. Backfilla a
// data_compra pra parcela 1 = (mês atual - (X-1) meses).
function calcularDataCompraRetro(parcelaAtual: number): string {
  const hoje = new Date();
  const target = new Date(
    hoje.getFullYear(),
    hoje.getMonth() - (parcelaAtual - 1),
    1,
  );
  return target.toISOString().slice(0, 10);
}

export function CompraFormDialog({
  cartaoId,
  diaFechamento,
  diaVencimento,
  compra,
  trigger,
  defaultOpen,
  onClose,
  categorias = [],
  membros = [],
}: Props) {
  const isEdit = Boolean(compra);

  const defaults = useMemo(
    () => ({
      descricao: compra?.descricao ?? "",
      valor_total:
        compra?.valor_total != null
          ? Number(compra.valor_total).toFixed(2).replace(".", ",")
          : "",
      data_compra: compra?.data_compra ?? hojeISO(),
      parcelas: String(compra?.parcelas ?? 1),
      em_andamento: (compra?.parcelas_ja_pagas ?? 0) > 0,
      parcela_atual: String((compra?.parcelas_ja_pagas ?? 0) + 1),
      categorias: selecaoDaLinha(compra),
      quemGastou: compra?.quem_gastou ?? NENHUM_QUEM,
    }),
    [
      compra?.id,
      compra?.descricao,
      compra?.valor_total,
      compra?.data_compra,
      compra?.parcelas,
      compra?.parcelas_ja_pagas,
      compra?.categoria_id,
      compra?.categorias_extras,
      compra?.quem_gastou,
    ],
  );

  // Estados controlados pro preview + interações
  const [valorRaw, setValorRaw] = useState(defaults.valor_total);
  const [dataRaw, setDataRaw] = useState(defaults.data_compra);
  const [parcelasRaw, setParcelasRaw] = useState(defaults.parcelas);
  const [emAndamento, setEmAndamento] = useState(defaults.em_andamento);
  const [parcelaAtualRaw, setParcelaAtualRaw] = useState(
    defaults.parcela_atual,
  );
  const [selCategorias, setSelCategorias] = useState<SelecaoCategorias>(
    defaults.categorias,
  );
  const [quemGastou, setQuemGastou] = useState(defaults.quemGastou);

  const ctrl = useFormDialog<CompraFormState>({
    action: isEdit ? updateCompra.bind(null, compra!.id) : createCompra,
    sucesso: isEdit ? "Compra atualizada." : "Compra cadastrada.",
    defaultOpen,
    onClose,
    aoSalvar: isEdit ? undefined : playCoinSound,
    reset: () => {
      setValorRaw(defaults.valor_total);
      setDataRaw(defaults.data_compra);
      setParcelasRaw(defaults.parcelas);
      setEmAndamento(defaults.em_andamento);
      setParcelaAtualRaw(defaults.parcela_atual);
      setSelCategorias(defaults.categorias);
      setQuemGastou(defaults.quemGastou);
    },
  });

  // "Em andamento" sobrescreve data_compra retroativamente: a parcela 1 tem
  // que cair (parcelaAtual - 1) meses atrás pra atual bater no mês corrente.
  // Só recalcula de 2 em diante — parcela 1 é compra nova, sem retroativo.
  function aplicarDataRetroativa(parcelaAtual: string) {
    const n = Number(parcelaAtual);
    if (!Number.isInteger(n) || n < 2) return;
    setDataRaw(calcularDataCompraRetro(n));
  }

  function onEmAndamentoChange(marcado: boolean) {
    setEmAndamento(marcado);
    if (!marcado) return;
    // Marcou numa compra nova: limpa o campo pra forçar digitar a parcela
    // real. No modo edição mantém o valor que veio da compra.
    const proxima = !isEdit && parcelaAtualRaw === "1" ? "" : parcelaAtualRaw;
    setParcelaAtualRaw(proxima);
    aplicarDataRetroativa(proxima);
  }

  function onParcelaAtualChange(valor: string) {
    setParcelaAtualRaw(valor);
    if (emAndamento) aplicarDataRetroativa(valor);
  }

  const valorInvalido = useMemo(() => {
    if (!valorRaw.trim()) return false;
    const n = parseBRLInput(valorRaw);
    return n === null || n <= 0;
  }, [valorRaw]);

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

    const parcelaAtual = emAndamento ? Number(parcelaAtualRaw) : 1;
    if (
      emAndamento &&
      (!Number.isInteger(parcelaAtual) ||
        parcelaAtual < 1 ||
        parcelaAtual > parcelas)
    )
      return null;

    const valores = valoresParcelas(total, parcelas);
    const primeira = mesPrimeiraParcela(dataRaw, {
      dia_fechamento: diaFechamento,
      dia_vencimento: diaVencimento,
    });

    // A virada de ano fica com `mesDaParcela`, o mesmo helper que o servidor
    // usa — este preview repetia a conta na mão e podia divergir dela.
    const idxAtual = parcelaAtual - 1;
    const mesAtualRef = mesDaParcela(primeira, idxAtual);
    const mesUltima = mesDaParcela(primeira, parcelas - 1);
    const ultimaLabel = `${MESES_PT_ABREV[mesUltima.mes - 1]}/${String(mesUltima.ano).slice(2)}`;

    return {
      valorParcela: valores[idxAtual],
      parcelaAtual,
      parcelas,
      restantes: parcelas - parcelaAtual,
      // Parcelas depois da atual.
      somaRestantes: valores.slice(parcelaAtual).reduce((s, v) => s + v, 0),
      mesAtualLabel: mesAtualRef.label,
      ultimaLabel,
      emAndamento,
    };
  }, [
    valorRaw,
    parcelasRaw,
    dataRaw,
    diaFechamento,
    diaVencimento,
    emAndamento,
    parcelaAtualRaw,
  ]);

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Nova compra"
      titulo={isEdit ? "Editar compra" : "Nova compra no cartão"}
      descricao={
        isEdit
          ? "Mudar parcelas ou data redistribui as faturas automaticamente."
          : "Se for parcelada, o valor é distribuído pelos meses a partir da data da compra."
      }
    >
      <input type="hidden" name="cartao_id" value={cartaoId} />

      <CampoForm htmlFor="descricao" rotulo="Descrição">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
          placeholder="Ex: iPhone, Amazon, Mercado"
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoForm htmlFor="valor_total" rotulo="Valor total (R$)">
          <Input
            id="valor_total"
            name="valor_total"
            required
            inputMode="decimal"
            aria-invalid={valorInvalido}
            value={valorRaw}
            onChange={(e) => setValorRaw(e.target.value)}
            placeholder="Ex: 1200,00"
          />
          {valorInvalido && (
            <p className="text-xs text-destructive">
              Digite um valor válido, ex: 1200,00.
            </p>
          )}
        </CampoForm>
        <CampoForm htmlFor="data_compra" rotulo="Data da compra">
          <Input
            id="data_compra"
            name="data_compra"
            type="date"
            required
            value={dataRaw}
            onChange={(e) => setDataRaw(e.target.value)}
            readOnly={emAndamento}
            className={emAndamento ? "opacity-60" : undefined}
            title={
              emAndamento
                ? "Calculada automaticamente pela parcela atual"
                : undefined
            }
          />
        </CampoForm>
      </div>

      <CampoForm htmlFor="parcelas" rotulo="Parcelas">
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
      </CampoForm>

      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="em_andamento"
            checked={emAndamento}
            onChange={(e) => onEmAndamentoChange(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Compra em andamento (já paguei algumas parcelas antes de cadastrar)
        </label>
        {emAndamento && (
          <div className="flex flex-col gap-2 pl-6 pt-1">
            <Label
              htmlFor="parcela_atual"
              className="text-xs text-muted-foreground"
            >
              Estou na parcela
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="parcela_atual"
                name="parcela_atual"
                type="number"
                min={1}
                max={Number(parcelasRaw) || 60}
                value={parcelaAtualRaw}
                onChange={(e) => onParcelaAtualChange(e.target.value)}
                className="max-w-[120px]"
              />
              <span className="text-sm text-muted-foreground">
                de {parcelasRaw || "?"}
              </span>
            </div>
          </div>
        )}
      </div>

      <CampoForm htmlFor="categorias" rotulo="Categorias (opcional)">
        <CategoriasComPrincipal
          categorias={categorias}
          value={selCategorias}
          onValueChange={setSelCategorias}
        />
      </CampoForm>

      <CampoForm htmlFor="quem_gastou" rotulo="Quem gastou (opcional)">
        <QuemGastouSelectField
          membros={membros}
          value={quemGastou}
          onValueChange={setQuemGastou}
        />
      </CampoForm>

      {preview && (
        <div className="rounded-2xl border border-border/60 bg-muted p-4">
          {preview.parcelas === 1 ? (
            <p className="text-sm">
              Cai integralmente na fatura de{" "}
              <strong>{preview.mesAtualLabel}</strong>.
            </p>
          ) : preview.emAndamento ? (
            <>
              <p className="text-sm">
                Parcela{" "}
                <strong className="tabular-nums">
                  {preview.parcelaAtual}/{preview.parcelas}
                </strong>{" "}
                de{" "}
                <strong className="tabular-nums">
                  {formatBRL(preview.valorParcela)}
                </strong>{" "}
                na fatura de <strong>{preview.mesAtualLabel}</strong>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ainda faltam{" "}
                <span className="tabular-nums">
                  {preview.restantes} parcelas
                </span>{" "}
                (
                <span className="tabular-nums">
                  {formatBRL(preview.somaRestantes)}
                </span>
                ) — última em {preview.ultimaLabel}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm">
                <strong>{preview.parcelas}x</strong> de{" "}
                <strong className="tabular-nums">
                  {formatBRL(preview.valorParcela)}
                </strong>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                De {preview.mesAtualLabel} até {preview.ultimaLabel}
              </p>
            </>
          )}
        </div>
      )}
    </FormDialogShell>
  );
}

export function EditCompraTrigger({
  compra,
  diaFechamento,
  diaVencimento,
  categorias,
  membros,
}: {
  compra: CompraRow;
  diaFechamento: number;
  diaVencimento: number;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
}) {
  return (
    <CompraFormDialog
      cartaoId={compra.cartao_id}
      diaFechamento={diaFechamento}
      diaVencimento={diaVencimento}
      compra={compra}
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
