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
import { formatBRL, parseBRLInput } from "@/lib/format";
import { mesPrimeiraParcela, valoresParcelas } from "@/lib/cartao-calc";
import { buildMes, hojeISO } from "@/lib/mes";
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import { NENHUM_QUEM, type MembroOpcao } from "@/lib/membros";
import { QuemGastouSelectField } from "@/components/quem-gastou-select";
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
  parcelas_ja_pagas: number | null;
  categoria: string | null;
  categoria_id: string | null;
  quem_gastou: string | null;
};

type Props = {
  cartaoId: string;
  diaFechamento: number;
  compra?: CompraRow;
  trigger?: React.ReactElement;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

const INITIAL_STATE: CompraFormState = {};

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

const todayISO = hojeISO;

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
  compra,
  trigger,
  categorias = [],
  membros = [],
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
      em_andamento: (compra?.parcelas_ja_pagas ?? 0) > 0,
      parcela_atual: String((compra?.parcelas_ja_pagas ?? 0) + 1),
      categoriaId: compra?.categoria_id ?? NENHUMA_CATEGORIA,
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
  const [categoriaId, setCategoriaId] = useState(defaults.categoriaId);
  const [quemGastou, setQuemGastou] = useState(defaults.quemGastou);

  useEffect(() => setValorRaw(defaults.valor_total), [defaults.valor_total]);
  useEffect(() => setDataRaw(defaults.data_compra), [defaults.data_compra]);
  useEffect(() => setParcelasRaw(defaults.parcelas), [defaults.parcelas]);
  useEffect(() => setEmAndamento(defaults.em_andamento), [defaults.em_andamento]);
  useEffect(
    () => setParcelaAtualRaw(defaults.parcela_atual),
    [defaults.parcela_atual],
  );
  useEffect(() => setCategoriaId(defaults.categoriaId), [defaults.categoriaId]);
  useEffect(() => setQuemGastou(defaults.quemGastou), [defaults.quemGastou]);

  // Quando marca "em andamento", sobrescreve data_compra retroativamente.
  // Só recalcula se parcela_atual >= 2 (parcela 1 = compra nova; nesse caso
  // deveria desmarcar o checkbox).
  useEffect(() => {
    if (!emAndamento) return;
    const parcelaAtual = Number(parcelaAtualRaw);
    if (!Number.isInteger(parcelaAtual) || parcelaAtual < 2) return;
    setDataRaw(calcularDataCompraRetro(parcelaAtual));
  }, [emAndamento, parcelaAtualRaw]);

  // Se o usuário marca o checkbox pela primeira vez (numa compra nova),
  // limpa o campo de parcela atual pra forçar ele a digitar um número real.
  // No modo edição, mantém o valor original da compra.
  useEffect(() => {
    if (!emAndamento) return;
    if (!isEdit && parcelaAtualRaw === "1") setParcelaAtualRaw("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emAndamento]);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(isEdit ? "Compra atualizada." : "Compra cadastrada.");
      if (!isEdit) playCoinSound();
    }
  }, [state, isEdit]);

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
    const primeira = mesPrimeiraParcela(dataRaw, diaFechamento);

    // Mês da parcela atual (indice 0-based = parcelaAtual - 1)
    const idxAtual = parcelaAtual - 1;
    const totalMesesAtual = primeira.mes + idxAtual;
    const anoAtual = primeira.ano + Math.floor((totalMesesAtual - 1) / 12);
    const mesAtualNum = ((totalMesesAtual - 1) % 12) + 1;
    const mesAtualRef = buildMes(anoAtual, mesAtualNum);

    // Última parcela
    const totalMesesUltima = primeira.mes + parcelas - 1;
    const anoUltima = primeira.ano + Math.floor((totalMesesUltima - 1) / 12);
    const mesUltimaNum = ((totalMesesUltima - 1) % 12) + 1;
    const ultimaLabel = `${MESES_PT_ABREV[mesUltimaNum - 1]}/${String(anoUltima).slice(2)}`;

    const valorParcela = valores[idxAtual];
    const restantes = parcelas - parcelaAtual;
    const somaRestantes = valores
      .slice(parcelaAtual) // parcelas depois da atual
      .reduce((s, v) => s + v, 0);

    return {
      valorParcela,
      parcelaAtual,
      parcelas,
      restantes,
      somaRestantes,
      mesAtualLabel: mesAtualRef.label,
      ultimaLabel,
      emAndamento,
    };
  }, [valorRaw, parcelasRaw, dataRaw, diaFechamento, emAndamento, parcelaAtualRaw]);

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
            {isEdit
              ? "Mudar parcelas ou data redistribui as faturas automaticamente."
              : "Se for parcelada, o valor é distribuído pelos meses a partir da data da compra."}
          </DialogDescription>
        </DialogHeader>

        <form key={open ? "open" : "closed"} action={formAction} className="flex flex-col gap-4">
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
              <Label
                htmlFor="valor_total"
                className="text-xs text-muted-foreground"
              >
                Valor total (R$)
              </Label>
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
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="data_compra"
                className="text-xs text-muted-foreground"
              >
                Data da compra
              </Label>
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
            </div>
          </div>

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

          <div className="flex flex-col gap-2 rounded-2xl border border-border/60 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="em_andamento"
                checked={emAndamento}
                onChange={(e) => setEmAndamento(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Compra em andamento (já paguei algumas parcelas antes de
              cadastrar)
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
                    onChange={(e) => setParcelaAtualRaw(e.target.value)}
                    className="max-w-[120px]"
                  />
                  <span className="text-sm text-muted-foreground">
                    de {parcelasRaw || "?"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="categoria_id"
              className="text-xs text-muted-foreground"
            >
              Categoria (opcional)
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
  categorias,
  membros,
}: {
  compra: CompraRow;
  diaFechamento: number;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
}) {
  return (
    <CompraFormDialog
      cartaoId={compra.cartao_id}
      diaFechamento={diaFechamento}
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
