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

type Props = {
  categoria?: CategoriaRow;
  trigger?: React.ReactElement;
};

const INITIAL_STATE: CategoriaFormState = {};

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
  "#3f3a37", // grafite
];

export function CategoriaFormDialog({ categoria, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(categoria);

  const action = isEdit
    ? updateCategoria.bind(null, categoria!.id)
    : createCategoria;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      nome: categoria?.nome ?? "",
      cor: categoria?.cor ?? CORES_SUGERIDAS[0],
      emoji: categoria?.emoji ?? "",
    }),
    [categoria?.id, categoria?.nome, categoria?.cor, categoria?.emoji],
  );

  const [cor, setCor] = useState(defaults.cor);

  useEffect(() => setCor(defaults.cor), [defaults.cor]);

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
              Nova categoria
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
          <DialogDescription>
            Um rótulo pra agrupar despesas: mercado, lazer, moradia, transporte…
          </DialogDescription>
        </DialogHeader>

        <form key={open ? "open" : "closed"} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome" className="text-xs text-muted-foreground">
              Nome
            </Label>
            <Input
              id="nome"
              name="nome"
              required
              defaultValue={defaults.nome}
              placeholder="Ex: mercado"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cor" className="text-xs text-muted-foreground">
                Cor
              </Label>
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
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="emoji"
                className="text-xs text-muted-foreground"
              >
                Emoji
              </Label>
              <Input
                id="emoji"
                name="emoji"
                defaultValue={defaults.emoji}
                maxLength={4}
                placeholder="🛒"
                className="w-20 text-center text-lg"
              />
            </div>
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
