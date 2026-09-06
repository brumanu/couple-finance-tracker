"use client";

import { useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useFormDialog,
  type PropsDialogControlado,
} from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import {
  createCategoria,
  updateCategoria,
  type CategoriaFormState,
} from "./actions";

export type CategoriaRow = {
  id: string;
  nome: string;
  cor: string;
  emoji: string | null;
};

type Props = PropsDialogControlado & {
  categoria?: CategoriaRow;
};

// Paleta sugerida — o casal pode digitar qualquer hex, mas essas cores
// combinam com o design system e ficam bonitas nos badges.
const CORES_SUGERIDAS = [
  "#c67139", // primary (terracota)
  "#e08a4f",
  "#e6a86a",
  "#7a9f76", // sage
  "#5e8a5a",
  "#4d7f8a", // teal escuro
  "#8e6bb0", // roxo
  "#b0546b", // vinho
  "#a4a89a", // neutral
  "#7a6f63", // grafite
];

export function CategoriaFormDialog({ categoria, trigger, defaultOpen, onClose }: Props) {
  const isEdit = Boolean(categoria);

  const defaults = useMemo(
    () => ({
      nome: categoria?.nome ?? "",
      cor: categoria?.cor ?? CORES_SUGERIDAS[0],
      emoji: categoria?.emoji ?? "",
    }),
    [categoria?.id, categoria?.nome, categoria?.cor, categoria?.emoji],
  );

  const [cor, setCor] = useState(defaults.cor);

  const ctrl = useFormDialog<CategoriaFormState>({
    action: isEdit
      ? updateCategoria.bind(null, categoria!.id)
      : createCategoria,
    sucesso: isEdit ? "Categoria atualizada." : "Categoria cadastrada.",
    defaultOpen,
    onClose,
    reset: () => setCor(defaults.cor),
  });

  return (
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Nova categoria"
      titulo={isEdit ? "Editar categoria" : "Nova categoria"}
      descricao="Um rótulo pra agrupar despesas: mercado, lazer, moradia, transporte…"
    >
      <CampoForm htmlFor="nome" rotulo="Nome">
        <Input
          id="nome"
          name="nome"
          required
          defaultValue={defaults.nome}
          placeholder="Ex: mercado"
          autoFocus
        />
      </CampoForm>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <CampoForm htmlFor="cor" rotulo="Cor">
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="cor"
              name="cor"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="h-9 w-14 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
            />
            <div className="flex flex-wrap gap-1.5">
              {CORES_SUGERIDAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={`size-6 rounded-full border ${
                    cor.toLowerCase() === c.toLowerCase()
                      ? "border-foreground"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
        </CampoForm>

        <CampoForm htmlFor="emoji" rotulo="Emoji">
          <Input
            id="emoji"
            name="emoji"
            defaultValue={defaults.emoji}
            maxLength={4}
            placeholder="🛒"
            className="w-20 text-center text-lg"
          />
        </CampoForm>
      </div>
    </FormDialogShell>
  );
}

export function EditCategoriaTrigger({
  categoria,
}: {
  categoria: CategoriaRow;
}) {
  return (
    <CategoriaFormDialog
      categoria={categoria}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
