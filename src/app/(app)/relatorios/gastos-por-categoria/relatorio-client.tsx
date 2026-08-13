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

export type LinhaTransacao = {
  id: string;
  categoriaId: string | null;
  categoriaNome: string | null;
  descricao: string;
  origem: string;
  data: string | null;
  valor: number;
};

export type CategoriaResumo = {
  id: string | null; // null = sem categoria
  nome: string;
  cor: string;
  emoji: string | null;
  total: number;
  qtd: number;
  pct: number;
};

const TODOS = "__todos__";
const SEM_CATEGORIA = "__sem_cat__";

type SortKey = "valor_desc" | "valor_asc" | "data_desc" | "data_asc";

const SORT_LABELS: Record<SortKey, string> = {
  valor_desc: "Valor (maior)",
  valor_asc: "Valor (menor)",
  data_desc: "Data (recentes)",
  data_asc: "Data (antigas)",
};

function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

type Props = {
  transacoes: LinhaTransacao[];
  categoriaResumo: CategoriaResumo[];
  categoriaOptions: CategoriaOpcao[];
  temSemCategoria: boolean;
  mesLabel: string;
};

export function RelatorioGastosPorCategoriaClient({
  transacoes,
  categoriaResumo,
  categoriaOptions,
  temSemCategoria,
  mesLabel,
}: Props) {
  const [categoriaId, setCategoriaId] = useState<string>(TODOS);
  const [sort, setSort] = useState<SortKey>("valor_desc");

  const filtradas = useMemo(() => {
    let arr = transacoes;
    if (categoriaId !== TODOS) {
      if (categoriaId === SEM_CATEGORIA)
        arr = arr.filter((t) => !t.categoriaId);
      else arr = arr.filter((t) => t.categoriaId === categoriaId);
    }

    const sorted = [...arr];
    switch (sort) {
      case "valor_asc":
        sorted.sort((a, b) => a.valor - b.valor);
        break;
      case "data_asc":
        sorted.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
        break;
      case "data_desc":
        sorted.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
        break;
      case "valor_desc":
      default:
        sorted.sort((a, b) => b.valor - a.valor);
        break;
    }
    return sorted;
  }, [transacoes, categoriaId, sort]);

  const grandTotal = transacoes.reduce((s, t) => s + t.valor, 0);
  const maiorCategoria = categoriaResumo[0];

  const algumFiltroAtivo = categoriaId !== TODOS;
  const limparFiltros = () => setCategoriaId(TODOS);

  const categoriaSelecionada = categoriaOptions.find(
    (c) => c.id === categoriaId,
  );

  function toggleCategoria(id: string | null) {
    const alvo = id === null ? SEM_CATEGORIA : id;
    setCategoriaId((atual) => (atual === alvo ? TODOS : alvo));
  }

  function categoriaAtiva(cat: CategoriaResumo): boolean {
    if (categoriaId === TODOS) return false;
    if (categoriaId === SEM_CATEGORIA) return cat.id === null;
    return cat.id === categoriaId;
  }

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

            <div className="flex min-w-[200px] flex-col gap-1.5">
              <Label
                htmlFor="f-sort"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Ordenar por
              </Label>
              <Select
                value={sort}
                onValueChange={(v) => v && setSort(v as SortKey)}
              >
                <SelectTrigger id="f-sort" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SORT_LABELS[k]}
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
            <strong className="text-foreground">{filtradas.length}</strong>{" "}
            {filtradas.length === 1 ? "transação" : "transações"}
            {transacoes.length !== filtradas.length
              ? ` de ${transacoes.length} no total`
              : ""}
            .
          </p>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumoCard
          label={`Total gasto em ${mesLabel}`}
          valor={formatBRL(grandTotal)}
          destaque
        />
        <ResumoCard
          label="Categorias com gasto"
          valor={String(categoriaResumo.length)}
          hint={
            categoriaResumo.length === 1 ? "categoria" : "categorias"
          }
        />
        <ResumoCard
          label="Maior categoria"
          valor={maiorCategoria ? maiorCategoria.nome : "—"}
          hint={
            maiorCategoria
              ? `${formatBRL(maiorCategoria.total)} · ${maiorCategoria.pct.toFixed(0)}% do total`
              : undefined
          }
        />
      </div>

      {categoriaResumo.length > 0 && (
        <Card>
          <div className="flex flex-col gap-1 p-3 md:p-4">
            <p className="px-2 pb-1 text-[11px] uppercase tracking-widest text-primary">
              Por categoria
            </p>
            {categoriaResumo.map((cat) => {
              const ativa = categoriaAtiva(cat);
              return (
                <button
                  key={cat.id ?? "sem-categoria"}
                  type="button"
                  onClick={() => toggleCategoria(cat.id)}
                  className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                    ativa ? "bg-muted/70" : ""
                  }`}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
                    style={{ backgroundColor: cat.cor, color: "#fff" }}
                    aria-hidden
                  >
                    {cat.emoji ?? cat.nome[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {cat.nome}
                      </p>
                      <span className="whitespace-nowrap tabular-nums text-sm font-medium">
                        {formatBRL(cat.total)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(2, cat.pct)}%`,
                            backgroundColor: cat.cor,
                          }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                        {cat.pct.toFixed(0)}% · {cat.qtd}{" "}
                        {cat.qtd === 1 ? "item" : "itens"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {filtradas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma transação corresponde aos filtros.
            </p>
            {algumFiltroAtivo && (
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Origem</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtradas.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{t.descricao}</span>
                        <span className="mt-0.5 text-xs text-muted-foreground">
                          {t.categoriaNome ?? "Sem categoria"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral" className="text-[10px]">
                        {t.origem}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDataBR(t.data)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-primary">
                      {formatBRL(t.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col divide-y divide-border/60 md:hidden">
            {filtradas.map((t) => (
              <li key={t.id} className="flex flex-col gap-1.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.categoriaNome ?? "Sem categoria"} ·{" "}
                      {formatDataBR(t.data)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap tabular-nums text-sm font-medium text-primary">
                    {formatBRL(t.valor)}
                  </span>
                </div>
                <Badge variant="neutral" className="w-fit text-[10px]">
                  {t.origem}
                </Badge>
              </li>
            ))}
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
          <p className="text-xs tabular-nums text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}
