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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BANCO_ICONES,
  BANCO_ICONE_IDS,
  Roundel,
  isBancoIconeId,
  type BancoIconeId,
} from "@/lib/bancos-icones";
import { createBanco, updateBanco, type BancoFormState } from "./actions";

export type BancoRow = {
  id: string;
  nome: string;
  cor: string;
  icone: BancoIconeId | string | null;
};

const INITIAL_STATE: BancoFormState = {};

// Nomes canônicos que podem ser sobrescritos ao trocar de ícone
// (não sobrescrevemos um nome customizado que o usuário digitou)
const NOMES_PRESET = new Set(
  BANCO_ICONE_IDS.map((id) => BANCO_ICONES[id].nome.toLowerCase()),
);

type Props = {
  banco?: BancoRow;
  trigger?: React.ReactElement;
};

export function BancoFormDialog({ banco, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(banco);
  const action = isEdit ? updateBanco.bind(null, banco!.id) : createBanco;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const defaults = useMemo(() => {
    const iconeInicial: BancoIconeId =
      banco && isBancoIconeId(banco.icone) ? banco.icone : "nubank";
    return {
      icone: iconeInicial,
      nome: banco?.nome ?? BANCO_ICONES[iconeInicial].nome,
    };
  }, [banco?.id, banco?.nome, banco?.icone]);

  const [icone, setIcone] = useState<BancoIconeId>(defaults.icone);
  const [nome, setNome] = useState(defaults.nome);
  useEffect(() => {
    setIcone(defaults.icone);
    setNome(defaults.nome);
  }, [defaults.icone, defaults.nome]);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  function onIconeChange(novo: string | null) {
    if (!novo || !isBancoIconeId(novo)) return;
    setIcone(novo);
    // Autofill do nome só se estiver vazio OU se ainda for um preset
    // (respeita nome customizado que o usuário já editou)
    const atual = nome.trim().toLowerCase();
    if (!atual || NOMES_PRESET.has(atual)) {
      setNome(BANCO_ICONES[novo].nome);
    }
  }

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
            Escolha o ícone e dê um nome. Ele vira o rosto do banco na tela de
            cartões.
          </DialogDescription>
        </DialogHeader>

        <form key={open ? "open" : "closed"} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="icone" value={icone} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="icone-trigger" className="text-xs text-muted-foreground">
              Ícone do banco
            </Label>
            <Select value={icone} onValueChange={onIconeChange}>
              <SelectTrigger id="icone-trigger">
                <SelectValue>
                  <span className="inline-flex items-center gap-2">
                    <Roundel
                      cor={BANCO_ICONES[icone].cor}
                      glifo={BANCO_ICONES[icone].glifo}
                      size={28}
                    />
                    <span>{BANCO_ICONES[icone].nome}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BANCO_ICONE_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    <span className="inline-flex items-center gap-2">
                      <Roundel
                        cor={BANCO_ICONES[id].cor}
                        glifo={BANCO_ICONES[id].glifo}
                        size={28}
                      />
                      <span>{BANCO_ICONES[id].nome}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nome" className="text-xs text-muted-foreground">
              Nome
            </Label>
            <Input
              id="nome"
              name="nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Nubank"
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
