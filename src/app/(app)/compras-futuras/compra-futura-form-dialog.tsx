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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NENHUMA_CATEGORIA, type CategoriaOpcao } from "@/lib/categorias";
import { CategoriaSelectField } from "@/components/categoria-select";
import { NENHUM_QUEM, type MembroOpcao } from "@/lib/membros";
import { QuemGastouSelectField } from "@/components/quem-gastou-select";
import { useResetAoAbrir } from "@/lib/form-dialog";
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

type Props = {
  item?: CompraFuturaRow;
  trigger?: React.ReactElement;
  categorias?: CategoriaOpcao[];
  membros?: MembroOpcao[];
};

const INITIAL_STATE: CompraFuturaFormState = {};

export function CompraFuturaFormDialog({
  item,
  trigger,
  categorias = [],
  membros = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(item);
  const action = isEdit
    ? updateCompraFutura.bind(null, item!.id)
    : createCompraFutura;
  // Fecha/notifica dentro da própria action em vez de um useEffect que
  // observa `state`: aqui já estamos numa transição, não num efeito pós-render.
  const [state, formAction, pending] = useActionState(
    async (prev: CompraFuturaFormState, formData: FormData) => {
      const resultado = await action(prev, formData);
      if (resultado.ok) {
        setOpen(false);
        toast.success(isEdit ? "Item atualizado." : "Item adicionado à lista.");
      }
      return resultado;
    },
    INITIAL_STATE,
  );

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

  useResetAoAbrir(open, () => {
    setPrioridade(defaults.prioridade);
    setCategoriaId(defaults.categoriaId);
    setQuem(defaults.quem);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm">
              <PlusIcon className="size-4" strokeWidth={2.75} />
              Novo item
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar item" : "Novo item na lista"}
          </DialogTitle>
          <DialogDescription>
            Só a descrição é obrigatória — anote o desejo agora e preencha o
            resto quando souber.
          </DialogDescription>
        </DialogHeader>

        <form
          key={open ? "open" : "closed"}
          action={formAction}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao" className="text-xs text-muted-foreground">
              O que é
            </Label>
            <Input
              id="descricao"
              name="descricao"
              required
              defaultValue={defaults.descricao}
              placeholder="Ex: Sofá da sala, Air Fryer, Viagem"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="valor_estimado"
                className="text-xs text-muted-foreground"
              >
                Valor estimado (opcional)
              </Label>
              <Input
                id="valor_estimado"
                name="valor_estimado"
                inputMode="decimal"
                defaultValue={defaults.valor}
                placeholder="Ex: 2500,00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="prioridade"
                className="text-xs text-muted-foreground"
              >
                Prioridade
              </Label>
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
            </div>
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
              Quem quer (opcional)
            </Label>
            <QuemGastouSelectField
              membros={membros}
              value={quem}
              onValueChange={setQuem}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="link" className="text-xs text-muted-foreground">
              Link do produto (opcional)
            </Label>
            <Input
              id="link"
              name="link"
              type="url"
              defaultValue={defaults.link}
              placeholder="https://..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="observacao"
              className="text-xs text-muted-foreground"
            >
              Observação (opcional)
            </Label>
            <Input
              id="observacao"
              name="observacao"
              defaultValue={defaults.observacao}
              placeholder="Ex: esperar a Black Friday"
            />
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
      </DialogContent>
    </Dialog>
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
