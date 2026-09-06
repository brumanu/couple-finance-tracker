"use client";

import { useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  useFormDialog,
  type PropsDialogControlado,
} from "@/lib/form-dialog";
import { CampoForm, FormDialogShell } from "@/components/form-dialog-shell";
import { createBanco, updateBanco, type BancoFormState } from "./actions";

export type BancoRow = {
  id: string;
  nome: string;
  cor: string;
  icone: BancoIconeId | string | null;
};

// Nomes canônicos que podem ser sobrescritos ao trocar de ícone
// (não sobrescrevemos um nome customizado que o usuário digitou)
const NOMES_PRESET = new Set(
  BANCO_ICONE_IDS.map((id) => BANCO_ICONES[id].nome.toLowerCase()),
);

type Props = PropsDialogControlado & {
  banco?: BancoRow;
};

export function BancoFormDialog({ banco, trigger, defaultOpen, onClose }: Props) {
  const isEdit = Boolean(banco);

  const defaults = useMemo(() => {
    const iconeInicial: BancoIconeId =
      banco && isBancoIconeId(banco.icone) ? banco.icone : "nubank";
    return {
      icone: iconeInicial,
      nome: banco?.nome ?? BANCO_ICONES[iconeInicial].nome,
    };
  }, [banco?.id, banco?.nome, banco?.icone]);

  // Os campos controlados vêm antes do useFormDialog: o reset roda de dentro
  // dele, durante o render, e precisa que os setters já existam.
  const [icone, setIcone] = useState<BancoIconeId>(defaults.icone);
  const [nome, setNome] = useState(defaults.nome);

  const ctrl = useFormDialog<BancoFormState>({
    action: isEdit ? updateBanco.bind(null, banco!.id) : createBanco,
    sucesso: isEdit ? "Banco atualizado." : "Banco cadastrado.",
    defaultOpen,
    onClose,
    reset: () => {
      setIcone(defaults.icone);
      setNome(defaults.nome);
    },
  });

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
    <FormDialogShell
      ctrl={ctrl}
      trigger={trigger}
      rotuloNovo="Novo banco"
      titulo={isEdit ? "Editar banco" : "Novo banco"}
      descricao="Escolha o ícone e dê um nome. Ele vira o rosto do banco na tela de cartões."
    >
      <input type="hidden" name="icone" value={icone} />

      <CampoForm htmlFor="icone-trigger" rotulo="Ícone do banco">
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
      </CampoForm>

      <CampoForm htmlFor="nome" rotulo="Nome">
        <Input
          id="nome"
          name="nome"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Nubank"
        />
      </CampoForm>
    </FormDialogShell>
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
