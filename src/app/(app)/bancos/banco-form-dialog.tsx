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
import { cn } from "@/lib/utils";
import { createBanco, updateBanco, type BancoFormState } from "./actions";

export type BancoRow = {
  id: string;
  nome: string;
  cor: string;
};

const INITIAL_STATE: BancoFormState = {};

// Paleta pensada pra combinar com o tema Organic + cores comuns de bancos
const COR_PRESETS = [
  { hex: "#c67139", label: "Terracota" },
  { hex: "#7a8a5e", label: "Sage" },
  { hex: "#8A05BE", label: "Nubank" },
  { hex: "#EC7000", label: "Itaú" },
  { hex: "#003DA5", label: "Bradesco" },
  { hex: "#B4084D", label: "Santander" },
  { hex: "#FFB600", label: "BB" },
  { hex: "#3E3E3E", label: "C6" },
  { hex: "#FF5C00", label: "Inter" },
  { hex: "#2AC26A", label: "Sicredi" },
];

type Props = {
  banco?: BancoRow;
  trigger?: React.ReactElement;
};

export function BancoFormDialog({ banco, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(banco);
  const action = isEdit ? updateBanco.bind(null, banco!.id) : createBanco;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(
    () => ({
      nome: banco?.nome ?? "",
      cor: banco?.cor ?? "#c67139",
    }),
    [banco?.id, banco?.nome, banco?.cor],
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
              Novo banco
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar banco" : "Novo banco"}</DialogTitle>
          <DialogDescription>
            Cadastre onde seus cartões vivem. A cor vira o avatar do banco na
            tela de cartões.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome" className="text-xs text-muted-foreground">
              Nome
            </Label>
            <Input
              id="nome"
              name="nome"
              required
              defaultValue={defaults.nome}
              placeholder="Ex: Nubank, Itaú, C6…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <input type="hidden" name="cor" value={cor} />
            <div className="flex flex-wrap gap-2">
              {COR_PRESETS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => setCor(p.hex)}
                  aria-label={p.label}
                  title={p.label}
                  className={cn(
                    "size-8 rounded-full transition-all",
                    cor.toLowerCase() === p.hex.toLowerCase()
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                      : "hover:scale-105",
                  )}
                  style={{ background: p.hex }}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center gap-3">
              <div
                className="size-9 rounded-full"
                style={{ background: cor }}
              />
              <Input
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                placeholder="#c67139"
                className="max-w-[120px]"
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

export function EditBancoTrigger({ banco }: { banco: BancoRow }) {
  return (
    <BancoFormDialog
      banco={banco}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Editar">
          <PencilIcon className="size-4" strokeWidth={2.75} />
        </Button>
      }
    />
  );
}
