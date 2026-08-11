"use client";

import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NENHUMA_CATEGORIA,
  type CategoriaOpcao,
} from "@/lib/categorias";

type Props = {
  id?: string;
  categorias: CategoriaOpcao[];
  /** Estado controlado — sentinela NENHUMA_CATEGORIA quando vazio */
  value: string;
  onValueChange: (v: string) => void;
};

/**
 * Select controlado de categorias com badge de cor + emoji. Emite via
 * hidden input `categoria_id` — o server action lê essa chave da
 * FormData. Quando "sem categoria", o hidden input vai vazio.
 */
export function CategoriaSelectField({
  id = "categoria_id",
  categorias,
  value,
  onValueChange,
}: Props) {
  const selecionada =
    value !== NENHUMA_CATEGORIA
      ? categorias.find((c) => c.id === value)
      : undefined;

  return (
    <>
      <input
        type="hidden"
        name="categoria_id"
        value={value === NENHUMA_CATEGORIA ? "" : value}
      />
      <Select value={value} onValueChange={(v) => v && onValueChange(v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {selecionada ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]"
                  style={{ backgroundColor: selecionada.cor, color: "#fff" }}
                  aria-hidden
                >
                  {selecionada.emoji ??
                    selecionada.nome[0]?.toUpperCase() ??
                    "?"}
                </span>
                <span>{selecionada.nome}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Sem categoria</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NENHUMA_CATEGORIA}>
            <span className="text-muted-foreground">Sem categoria</span>
          </SelectItem>
          {categorias.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="inline-flex items-center gap-2">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]"
                  style={{ backgroundColor: c.cor, color: "#fff" }}
                  aria-hidden
                >
                  {c.emoji ?? c.nome[0]?.toUpperCase() ?? "?"}
                </span>
                <span>{c.nome}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {categorias.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma cadastrada ainda.{" "}
          <Link
            href="/categorias"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Criar categoria
          </Link>
          .
        </p>
      )}
    </>
  );
}
