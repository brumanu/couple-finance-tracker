"use client";

import { UserIcon, UsersIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NENHUM_QUEM, QUEM_CASAL, type MembroOpcao } from "@/lib/membros";

type Props = {
  id?: string;
  membros: MembroOpcao[];
  /** Estado controlado — sentinela NENHUM_QUEM quando não especificado */
  value: string;
  onValueChange: (v: string) => void;
};

/**
 * Select controlado de "quem gastou": os dois membros do casal + opção
 * "Casal" (gasto compartilhado). Emite via hidden input `quem_gastou` —
 * o server action lê essa chave da FormData. Quando não especificado,
 * o hidden input vai vazio.
 */
export function QuemGastouSelectField({
  id = "quem_gastou",
  membros,
  value,
  onValueChange,
}: Props) {
  const membroSelecionado =
    value !== NENHUM_QUEM && value !== QUEM_CASAL
      ? membros.find((m) => m.id === value)
      : undefined;

  return (
    <>
      <input
        type="hidden"
        name="quem_gastou"
        value={value === NENHUM_QUEM ? "" : value}
      />
      <Select value={value} onValueChange={(v) => v && onValueChange(v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {value === QUEM_CASAL ? (
              <span className="inline-flex items-center gap-2">
                <UsersIcon className="size-4 text-muted-foreground" />
                <span>Casal</span>
              </span>
            ) : membroSelecionado ? (
              <span className="inline-flex items-center gap-2">
                <UserIcon className="size-4 text-muted-foreground" />
                <span>{membroSelecionado.nome}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Não especificado</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NENHUM_QUEM}>
            <span className="text-muted-foreground">Não especificado</span>
          </SelectItem>
          {membros.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="inline-flex items-center gap-2">
                <UserIcon className="size-4 text-muted-foreground" />
                <span>{m.nome}</span>
              </span>
            </SelectItem>
          ))}
          <SelectItem value={QUEM_CASAL}>
            <span className="inline-flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" />
              <span>Casal</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
