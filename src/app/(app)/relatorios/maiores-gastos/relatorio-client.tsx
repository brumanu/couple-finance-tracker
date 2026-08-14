"use client";

import { useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";
import type { CategoriaOpcao } from "@/lib/categorias";

export type LinhaGasto = {
  id: string;
  categoriaId: string | null;
  categoriaNome: string | null;
  descricao: string;
  origem: string;
  data: string | null;
  valor: number;
};

const TODOS = "__todos__";
const SEM_CATEGORIA = "__sem_cat__";
const TOP_N = 20;

function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function CategoriaChip({
  categoria,
  nome,
}: {
  categoria: CategoriaOpcao | undefined;
  nome: string | null;
}) {
  if (!categoria) {
    return (
      <span className="text-xs text-muted-foreground">
        {nome ?? "Sem categoria"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-full text-[9px]"
        style={{ backgroundColor: categoria.cor, color: "#fff" }}
        aria-hidden
      >
        {categoria.emoji ?? categoria.nome[0]?.toUpperCase() ?? "?"}
      </span>
      <span className="text-muted-foreground">{categoria.nome}</span>
    </span>
  );
}

type Props = {
  linhas: LinhaGasto[];
  categoriaOptions: CategoriaOpcao[];
  todasCategorias: CategoriaOpcao[];
  temSemCategoria: boolean;
  mesLabel: string;
};

export function RelatorioMaioresGastosClient({
  linhas,
  categoriaOptions,
  todasCategorias,
  temSemCategoria,
  mesLabel,
}: Props) {
  const [categoriaId, setCategoriaId] = useState<string>(TODOS);

  const categoriaById = useMemo(
    () => new Map(todasCategorias.map((c) => [c.id, c] as const)),
    [todasCategorias],
  );

  const filtradas = useMemo(() => {
    if (categoriaId === TODOS) return linhas;
    if (categoriaId === SEM_CATEGORIA)
      return linhas.filter((l) => !l.categoriaId);
    return linhas.filter((l) => l.categoriaId === categoriaId);
  }, [linhas, categoriaId]);

  const ordenadas = useMemo(
    () => [...filtradas].sort((a, b) => b.valor - a.valor),
    [filtradas],
  );

  // Total da fatia filtrada (não só do top N) — base pro "% do total".
  const totalFiltrado = filtradas.reduce((s, l) => s + l.valor, 0);

  const topN = ordenadas.slice(0, TOP_N);
  const somaTopN = topN.reduce((s, l) => s + l.valor, 0);
  const pctTopN = totalFiltrado > 0 ? (somaTopN / totalFiltrado) * 100 : 0;
  const maior = topN[0];
  const maiorValor = maior?.valor ?? 0;

  const algumFiltroAtivo = categoriaId !== TODOS;
  const limparFiltros = () => setCategoriaId(TODOS);

  const categoriaSelecionada = categoriaOptions.find(
    (c) => c.id === categoriaId,
  );

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 p-4 md:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <Label
                htmlFor="f-categoria"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Categoria
              </Label>
              <Select
                value={categoriaId}
                onValueChange={(v) => v && setCategoriaId(v)}
              >
                <SelectTrigger id="f-categoria" className="w-full">
                  <SelectValue>
                    {categoriaId === SEM_CATEGORIA ? (
                      <span className="text-muted-foreground">
                        Sem categoria
                      </span>
                    ) : categoriaSelecionada ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]"
                          style={{
                            backgroundColor: categoriaSelecionada.cor,
                            color: "#fff",
                          }}
                          aria-hidden
                        >
                          {categoriaSelecionada.emoji ??
                            categoriaSelecionada.nome[0]?.toUpperCase() ??
                            "?"}
                        </span>
                        <span>{categoriaSelecionada.nome}</span>
                      </span>
                    ) : (
                      <span>Todas as categorias</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas as categorias</SelectItem>
                  {temSemCategoria && (
                    <SelectItem value={SEM_CATEGORIA}>
                      <span className="text-muted-foreground">
                        Sem categoria
                      </span>
                    </SelectItem>
                  )}
                  {categoriaOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]"
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
            </div>

            {algumFiltroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="self-end"
              >
                <XIcon className="size-4" strokeWidth={2.75} />
                Limpar
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Mostrando{" "}
            <strong className="text-foreground">{topN.length}</strong>{" "}
            {topN.length === 1 ? "lançamento" : "lançamentos"}
            {filtradas.length > topN.length
              ? ` (top ${TOP_N} de ${filtradas.length})`
              : ""}
            .
          </p>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumoCard
          label="Maior gasto individual"
          valor={maior ? formatBRL(maior.valor) : "—"}
          hint={maior?.descricao}
          destaque
        />
        <ResumoCard
          label={`Soma do top ${TOP_N}`}
          valor={formatBRL(somaTopN)}
        />
        <ResumoCard
          label="% do total do mês"
          valor={`${pctTopN.toFixed(0)}%`}
          hint={`de ${formatBRL(totalFiltrado)} em ${mesLabel}`}
        />
      </div>

      {topN.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum lançamento corresponde aos filtros.
            </p>
            {algumFiltroAtivo && (
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="flex flex-col divide-y divide-border/60">
            {topN.map((l, i) => {
              const pct =
                maiorValor > 0 ? (l.valor / maiorValor) * 100 : 0;
              return (
                <li key={l.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 truncate text-sm font-medium">
                          {l.descricao}
                        </p>
                        <span className="whitespace-nowrap tabular-nums text-sm font-medium text-primary">
                          {formatBRL(l.valor)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <CategoriaChip
                          categoria={
                            l.categoriaId
                              ? categoriaById.get(l.categoriaId)
                              : undefined
                          }
                          nome={l.categoriaNome}
                        />
                        <Badge variant="neutral" className="text-[10px]">
                          {l.origem}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          · {formatDataBR(l.data)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

function ResumoCard({
  label,
  valor,
  hint,
  destaque,
}: {
  label: string;
  valor: string;
  hint?: string;
  destaque?: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-2 p-5">
        <p className="text-[11px] uppercase tracking-widest text-primary">
          {label}
        </p>
        <p
          className={`font-heading tabular-nums truncate ${
            destaque ? "text-primary" : ""
          }`}
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", lineHeight: 1 }}
        >
          {valor}
        </p>
        {hint && (
          <p className="truncate text-xs tabular-nums text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}
