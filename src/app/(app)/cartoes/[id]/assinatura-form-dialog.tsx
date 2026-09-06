"use client";

import { useMemo, useState } from "react";
import { RepeatIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hojeISO } from "@/lib/mes";
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
  createAssinatura,
  updateAssinatura,
  type AssinaturaFormState,
} from "./assinatura-actions";

export type AssinaturaRow = {
  id: string;
  cartao_id: string;
  descricao: string;
  valor_mensal: number | string;
  categoria: string | null;
  categoria_id: string | null;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  ativa: boolean;
  quem_gastou: string | null;
};

type Props = PropsDialogControlado & {
  cartaoId: string;
  assinatura?: AssinaturaRow;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

export function AssinaturaFormDialog({
  cartaoId,
  assinatura,
  trigger,
  defaultOpen,
  onClose,
  categorias = [],
  membros = [],
}: Props) {
  const isEdit = Boolean(assinatura);

  const defaults = useMemo(
    () => ({
      descricao: assinatura?.descricao ?? "",
      valor_mensal:
        assinatura?.valor_mensal != null
          ? Number(assinatura.valor_mensal).toFixed(2).replace(".", ",")
          : "",
      categoriaId: assinatura?.categoria_id ?? NENHUMA_CATEGORIA,
      inicio_vigencia: assinatura?.inicio_vigencia ?? hojeISO(),
      fim_vigencia: assinatura?.fim_vigencia ?? "",
      ativa: assinatura?.ativa ?? true,
      quemGastou: assinatura?.quem_gastou ?? NENHUM_QUEM,
    }),
    [
      assinatura?.id,
      assinatura?.descricao,
      assinatura?.valor_mensal,
      assinatura?.categoria_id,
      assinatura?.inicio_vigencia,
      assinatura?.fim_vigencia,
      assinatura?.ativa,
      assinatura?.quem_gastou,
    ],
  );

  const [categoriaId, setCategoriaId] = useState(defaults.categoriaId);
  const [quemGastou, setQuemGastou] = useState(defaults.quemGastou);

  const ctrl = useFormDialog<AssinaturaFormState>({
    action: isEdit
      ? updateAssinatura.bind(null, assinatura!.id)
      : createAssinatura,
    sucesso: isEdit ? "Assinatura atualizada." : "Assinatura cadastrada.",
    defaultOpen,
    onClose,
    reset: () => {
      setCategoriaId(defaults.categoriaId);
      setQuemGastou(defaults.quemGastou);
    },
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={
        // `?? ` engoliria o `null` que o provider da lista passa; aqui só o
        // ausente (undefined) cai no botão padrão.
        trigger === undefined ? (
          <Button size="sm" variant="outline">
            <RepeatIcon className="size-4" strokeWidth={2.75} />
            Nova assinatura
          </Button>
        ) : (
          trigger
        )
      }
      titulo={isEdit ? "Editar assinatura" : "Nova assinatura"}
      descricao="Cobrança que repete todo mês no cartão. Netflix, Spotify, mensalidades e por aí vai."
    >
      <input type="hidden" name="cartao_id" value={cartaoId} />

      <CampoForm htmlFor="descricao" rotulo="Descrição">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
          placeholder="Ex: Netflix, Spotify, ChatGPT…"
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoForm htmlFor="valor_mensal" rotulo="Valor mensal (R$)">
          <Input
            id="valor_mensal"
            name="valor_mensal"
            required
            inputMode="decimal"
            defaultValue={defaults.valor_mensal}
            placeholder="Ex: 55,90"
          />
        </CampoForm>
        <CampoForm htmlFor="categoria_id" rotulo="Categoria (opcional)">
          <CategoriaSelectField
            categorias={categorias}
            value={categoriaId}
            onValueChange={setCategoriaId}
          />
        </CampoForm>
      </div>

      <CampoForm htmlFor="quem_gastou" rotulo="Quem gastou (opcional)">
        <QuemGastouSelectField
          membros={membros}
          value={quemGastou}
          onValueChange={setQuemGastou}
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoForm htmlFor="inicio_vigencia" rotulo="Ativa desde">
          <Input
            id="inicio_vigencia"
            name="inicio_vigencia"
            type="date"
            required
            defaultValue={defaults.inicio_vigencia}
          />
        </CampoForm>
        <CampoForm htmlFor="fim_vigencia" rotulo="Encerra em (opcional)">
          <Input
            id="fim_vigencia"
            name="fim_vigencia"
            type="date"
            defaultValue={defaults.fim_vigencia}
          />
        </CampoForm>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ativa"
          name="ativa"
          defaultChecked={defaults.ativa}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="ativa" className="cursor-pointer">
          Assinatura ativa (entra na fatura enquanto vigente)
        </Label>
      </div>
    </FormDialogShell>
  );
}

export function EditAssinaturaTrigger({
  assinatura,
  cartaoId,
  categorias,
  membros,
}: {
  assinatura: AssinaturaRow;
  cartaoId: string;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
}) {
  return (
    <AssinaturaFormDialog
      cartaoId={cartaoId}
      assinatura={assinatura}
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
