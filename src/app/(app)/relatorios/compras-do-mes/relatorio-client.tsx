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
import {
  EditDespesaTrigger,
  type DespesaRow,
} from "../../despesas/despesa-form-dialog";
import { DespesaActionsMenu } from "../../despesas/despesa-actions-menu";
import {
  EditRecorrenteTrigger,
  type RecorrenteRow,
} from "../../recorrentes/recorrente-form-dialog";
import { RecorrenteActionsMenu } from "../../recorrentes/recorrente-actions-menu";
import {
  EditCompraTrigger,
  type CompraRow,
} from "../../cartoes/[id]/compra-form-dialog";
import { CompraActionsMenu } from "../../cartoes/[id]/compra-actions-menu";
import {
  EditAssinaturaTrigger,
  type AssinaturaRow,
} from "../../cartoes/[id]/assinatura-form-dialog";
import { AssinaturaActionsMenu } from "../../cartoes/[id]/assinatura-actions-menu";

export type LinhaCompra =
  | {
      id: string;
      tipo: "despesa";
      categoriaId: string | null;
      categoriaNome: string | null;
      descricao: string;
      origem: string;
      data: string | null;
      valor: number;
      despesa: DespesaRow;
    }
  | {
      id: string;
      tipo: "conta_fixa";
      categoriaId: string | null;
      categoriaNome: string | null;
      descricao: string;
      origem: string;
      data: string | null;
      valor: number;
      recorrente: RecorrenteRow;
    }
  | {
      id: string;
      tipo: "compra_cartao";
      categoriaId: string | null;
      categoriaNome: string | null;
      descricao: string;
      origem: string;
      data: string | null;
      valor: number;
      compra: CompraRow;
      diaFechamento: number;
    }
  | {
      id: string;
      tipo: "assinatura";
      categoriaId: string | null;
      categoriaNome: string | null;
      descricao: string;
      origem: string;
      data: string | null;
      valor: number;
      assinatura: AssinaturaRow;
      ativaHoje: boolean;
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
  linhas: LinhaCompra[];
  categoriaOptions: CategoriaOpcao[];
  todasCategorias: CategoriaOpcao[];
  temSemCategoria: boolean;
  mesLabel: string;
};

export function RelatorioComprasDoMesClient({
  linhas,
  categoriaOptions,
  todasCategorias,
  temSemCategoria,
  mesLabel,
}: Props) {
  const [categoriaId, setCategoriaId] = useState<string>(TODOS);
  const [sort, setSort] = useState<SortKey>("data_desc");

  const categoriaById = useMemo(
    () => new Map(todasCategorias.map((c) => [c.id, c] as const)),
    [todasCategorias],
  );

  const filtradas = useMemo(() => {
    let arr = linhas;
    if (categoriaId !== TODOS) {
      if (categoriaId === SEM_CATEGORIA)
        arr = arr.filter((l) => !l.categoriaId);
      else arr = arr.filter((l) => l.categoriaId === categoriaId);
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
  }, [linhas, categoriaId, sort]);

  const grandTotal = linhas.reduce((s, l) => s + l.valor, 0);

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
            {filtradas.length === 1 ? "lançamento" : "lançamentos"}
            {linhas.length !== filtradas.length
              ? ` de ${linhas.length} no total`
              : ""}
            .
          </p>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <ResumoCard
          label={`Total em ${mesLabel}`}
          valor={formatBRL(grandTotal)}
          destaque
        />
        <ResumoCard
          label="Lançamentos no mês"
          valor={String(linhas.length)}
          hint={linhas.length === 1 ? "item" : "itens"}
        />
      </div>

      {filtradas.length === 0 ? (
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
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Origem</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtradas.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">{l.descricao}</span>
                    </td>
                    <td className="px-4 py-3">
                      <CategoriaChip
                        categoria={
                          l.categoriaId
                            ? categoriaById.get(l.categoriaId)
                            : undefined
                        }
                        nome={l.categoriaNome}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral" className="text-[10px]">
                        {l.origem}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDataBR(l.data)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-primary">
                      {formatBRL(l.valor)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <LinhaAcoes linha={l} categorias={todasCategorias} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col divide-y divide-border/60 md:hidden">
            {filtradas.map((l) => (
              <li key={l.id} className="flex flex-col gap-1.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {l.descricao}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <CategoriaChip
                        categoria={
                          l.categoriaId
                            ? categoriaById.get(l.categoriaId)
                            : undefined
                        }
                        nome={l.categoriaNome}
                      />
                      <span className="text-xs text-muted-foreground">
                        · {formatDataBR(l.data)}
                      </span>
                    </div>
                  </div>
                  <span className="whitespace-nowrap tabular-nums text-sm font-medium text-primary">
                    {formatBRL(l.valor)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="neutral" className="w-fit text-[10px]">
                    {l.origem}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <LinhaAcoes linha={l} categorias={todasCategorias} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function LinhaAcoes({
  linha,
  categorias,
}: {
  linha: LinhaCompra;
  categorias: CategoriaOpcao[];
}) {
  switch (linha.tipo) {
    case "despesa":
      return (
        <>
          <EditDespesaTrigger despesa={linha.despesa} categorias={categorias} />
          <DespesaActionsMenu
            id={linha.despesa.id}
            descricao={linha.despesa.descricao}
          />
        </>
      );
    case "conta_fixa":
      return (
        <>
          <EditRecorrenteTrigger
            recorrente={linha.recorrente}
            categorias={categorias}
          />
          <RecorrenteActionsMenu
            id={linha.recorrente.id}
            ativa={linha.recorrente.ativa}
            descricao={linha.recorrente.descricao}
          />
        </>
      );
    case "compra_cartao":
      return (
        <>
          <EditCompraTrigger
            compra={linha.compra}
            diaFechamento={linha.diaFechamento}
            categorias={categorias}
          />
          <CompraActionsMenu
            id={linha.compra.id}
            cartaoId={linha.compra.cartao_id}
            descricao={linha.compra.descricao}
          />
        </>
      );
    case "assinatura":
      return (
        <>
          <EditAssinaturaTrigger
            assinatura={linha.assinatura}
            cartaoId={linha.assinatura.cartao_id}
            categorias={categorias}
          />
          <AssinaturaActionsMenu
            id={linha.assinatura.id}
            cartaoId={linha.assinatura.cartao_id}
            descricao={linha.assinatura.descricao}
            ativa={linha.assinatura.ativa}
            ativaHoje={linha.ativaHoje}
          />
        </>
      );
  }
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
          <p className="text-xs tabular-nums text-muted-foreground">{hint}</p>
        )}
      </div>
    </Card>
  );
}
