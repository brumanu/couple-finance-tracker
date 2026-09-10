"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BolhaCategoria,
  CategoriasMultiSelect,
} from "@/components/categorias-multi-select";
import type { CategoriaOpcao } from "@/lib/categorias";
import { FILTRO_SEM_CATEGORIA } from "@/lib/categorias-extras";

const TODAS = "__todas__";

type Props = {
  id?: string;
  /** As categorias que aparecem nas linhas do relatório. */
  categorias: CategoriaOpcao[];
  /** Ids marcados (e/ou FILTRO_SEM_CATEGORIA). Vazio = todas. */
  value: string[];
  onValueChange: (ids: string[]) => void;
  /** Mostra "Sem categoria" — só quando alguma linha não tem categoria. */
  temSemCategoria?: boolean;
  /**
   * Controle opcional do "Apenas uma categoria?". Só precisa quem também
   * muda a seleção por fora — os cartões de Gastos por categoria, que num
   * modo trocam a categoria e no outro somam.
   */
  apenasUma?: boolean;
  onApenasUmaChange?: (apenasUma: boolean) => void;
};

/**
 * Filtro de categoria dos relatórios: várias de uma vez, ou uma só.
 *
 * Por padrão marca quantas quiser. "Apenas uma categoria?" troca pelo select
 * de sempre, que resolve o caso comum em um toque — escolher e pronto, sem
 * menu que fica aberto esperando mais marcações. Ao trocar pra uma só com
 * várias marcadas, fica a primeira.
 *
 * O componente só escolhe; o que "passar no filtro" significa (principal ou
 * também extras) é de cada relatório — ver `passaNoFiltroDeCategorias`.
 */
export function FiltroCategorias({
  id = "f-categoria",
  categorias,
  value,
  onValueChange,
  temSemCategoria = false,
  apenasUma: apenasUmaControlado,
  onApenasUmaChange,
}: Props) {
  const [apenasUmaLocal, setApenasUmaLocal] = useState(false);
  const apenasUma = apenasUmaControlado ?? apenasUmaLocal;

  function alternarApenasUma(marcado: boolean) {
    setApenasUmaLocal(marcado);
    onApenasUmaChange?.(marcado);
    if (marcado && value.length > 1) onValueChange(value.slice(0, 1));
  }

  const semCategoria = temSemCategoria
    ? { valor: FILTRO_SEM_CATEGORIA, rotulo: "Sem categoria" }
    : undefined;

  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={id}
          className="text-[10px] uppercase tracking-widest text-muted-foreground"
        >
          Categoria
        </Label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none hover:text-foreground">
          <input
            type="checkbox"
            checked={apenasUma}
            onChange={(e) => alternarApenasUma(e.target.checked)}
            className="size-3.5 cursor-pointer accent-primary"
          />
          Apenas uma categoria?
        </label>
      </div>

      {apenasUma ? (
        <SelectUma
          id={id}
          categorias={categorias}
          value={value[0] ?? TODAS}
          onValueChange={(v) => onValueChange(v === TODAS ? [] : [v])}
          semCategoria={semCategoria}
        />
      ) : (
        <CategoriasMultiSelect
          id={id}
          categorias={categorias}
          value={value}
          onValueChange={onValueChange}
          opcaoEspecial={semCategoria}
          placeholder="Todas as categorias"
        />
      )}
    </div>
  );
}

function SelectUma({
  id,
  categorias,
  value,
  onValueChange,
  semCategoria,
}: {
  id: string;
  categorias: CategoriaOpcao[];
  value: string;
  onValueChange: (v: string) => void;
  semCategoria?: { valor: string; rotulo: string };
}) {
  const selecionada = categorias.find((c) => c.id === value);

  return (
    <Select value={value} onValueChange={(v) => v && onValueChange(v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue>
          {value === FILTRO_SEM_CATEGORIA ? (
            <span className="text-muted-foreground">Sem categoria</span>
          ) : selecionada ? (
            <span className="inline-flex items-center gap-2">
              <BolhaCategoria categoria={selecionada} />
              <span>{selecionada.nome}</span>
            </span>
          ) : (
            <span>Todas as categorias</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODAS}>Todas as categorias</SelectItem>
        {semCategoria && (
          <SelectItem value={semCategoria.valor}>
            <span className="text-muted-foreground">{semCategoria.rotulo}</span>
          </SelectItem>
        )}
        {categorias.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="inline-flex items-center gap-2">
              <BolhaCategoria categoria={c} />
              <span>{c.nome}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
