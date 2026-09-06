"use client";

import { useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  createCompraFutura,
  updateCompraFutura,
  type CompraFuturaFormState,
} from "./actions";

export type CompraFuturaRow = {
  id: string;
  descricao: string;
  valor_estimado: number | string | null;
  prioridade: number;
  categoria: string | null;
  categoria_id: string | null;
  quem_quer: string | null;
  link: string | null;
  observacao: string | null;
  comprado_em: string | null;
};

export const PRIORIDADE_LABEL: Record<number, string> = {
  1: "Alta",
  2: "Média",
  3: "Baixa",
};

type Props = PropsDialogControlado & {
  item?: CompraFuturaRow;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

export function CompraFuturaFormDialog({
  item,
  trigger,
  defaultOpen,
  onClose,
  categorias = [],
  membros = [],
}: Props) {
  const isEdit = Boolean(item);

  const defaults = useMemo(
    () => ({
      descricao: item?.descricao ?? "",
      valor:
        item?.valor_estimado != null
          ? Number(item.valor_estimado).toFixed(2).replace(".", ",")
          : "",
      prioridade: String(item?.prioridade ?? 2),
      categoriaId: item?.categoria_id ?? NENHUMA_CATEGORIA,
      quem: item?.quem_quer ?? NENHUM_QUEM,
      link: item?.link ?? "",
      observacao: item?.observacao ?? "",
    }),
    [
      item?.id,
      item?.descricao,
      item?.valor_estimado,
      item?.prioridade,
      item?.categoria_id,
      item?.quem_quer,
      item?.link,
      item?.observacao,
    ],
  );

  const [prioridade, setPrioridade] = useState(defaults.prioridade);
  const [categoriaId, setCategoriaId] = useState(defaults.categoriaId);
  const [quem, setQuem] = useState(defaults.quem);

  const ctrl = useFormDialog<CompraFuturaFormState>({
    action: isEdit
      ? updateCompraFutura.bind(null, item!.id)
      : createCompraFutura,
    sucesso: isEdit ? "Item atualizado." : "Item adicionado à lista.",
    defaultOpen,
    onClose,
    reset: () => {
      setPrioridade(defaults.prioridade);
      setCategoriaId(defaults.categoriaId);
      setQuem(defaults.quem);
    },
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Novo item"
      titulo={isEdit ? "Editar item" : "Novo item na lista"}
      descricao="Só a descrição é obrigatória — anote o desejo agora e preencha o resto quando souber."
    >
      <CampoForm htmlFor="descricao" rotulo="O que é">
        <Input
          id="descricao"
          name="descricao"
          required
          defaultValue={defaults.descricao}
          placeholder="Ex: Sofá da sala, Air Fryer, Viagem"
        />
      </CampoForm>

      <div className="grid grid-cols-2 gap-3">
        <CampoForm htmlFor="valor_estimado" rotulo="Valor estimado (opcional)">
          <Input
            id="valor_estimado"
            name="valor_estimado"
            inputMode="decimal"
            defaultValue={defaults.valor}
            placeholder="Ex: 2500,00"
          />
        </CampoForm>
        <CampoForm htmlFor="prioridade" rotulo="Prioridade">
          <input type="hidden" name="prioridade" value={prioridade} />
          <Select
            value={prioridade}
            onValueChange={(v) => v && setPrioridade(v)}
          >
            <SelectTrigger id="prioridade" className="w-full">
              <SelectValue>
                {PRIORIDADE_LABEL[Number(prioridade)] ?? "Média"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Alta</SelectItem>
              <SelectItem value="2">Média</SelectItem>
              <SelectItem value="3">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </CampoForm>
      </div>

      <CampoForm htmlFor="categoria_id" rotulo="Categoria (opcional)">
        <CategoriaSelectField
          categorias={categorias}
          value={categoriaId}
          onValueChange={setCategoriaId}
        />
      </CampoForm>

      <CampoForm htmlFor="quem_gastou" rotulo="Quem quer (opcional)">
        <QuemGastouSelectField
          membros={membros}
          value={quem}
          onValueChange={setQuem}
        />
      </CampoForm>

      <CampoForm htmlFor="link" rotulo="Link do produto (opcional)">
        <Input
          id="link"
          name="link"
          type="url"
          defaultValue={defaults.link}
          placeholder="https://..."
        />
      </CampoForm>

      <CampoForm htmlFor="observacao" rotulo="Observação (opcional)">
        <Input
          id="observacao"
          name="observacao"
          defaultValue={defaults.observacao}
          placeholder="Ex: esperar a Black Friday"
        />
      </CampoForm>
    </FormDialogShell>
  );
}

export function EditCompraFuturaTrigger({
  item,
  categorias,
  membros,
}: {
  item: CompraFuturaRow;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
}) {
  return (
    <CompraFuturaFormDialog
      item={item}
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
