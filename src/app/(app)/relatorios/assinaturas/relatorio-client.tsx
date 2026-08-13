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
import { BancoIcone } from "@/lib/bancos-icones";
import { formatBRL } from "@/lib/format";
import type { CategoriaOpcao } from "@/lib/categorias";

export type LinhaAssinatura = {
  id: string;
  descricao: string;
  categoria: string | null;
  categoriaId: string | null;
  cartaoId: string;
  cartaoLabel: string;
  bancoIcone: string | null;
  bancoCor: string;
  bancoNome: string;
  valorMensal: number;
  inicioVigencia: string;
  fimVigencia: string | null;
  status: "ativa" | "futura" | "encerrada" | "pausada";
  contaNoMes: boolean;
};

export type CartaoOpcaoRel = {
  id: string;
  label: string;
  bancoIcone: string | null;
  bancoCor: string;
  bancoNome: string;
};

const TODOS = "__todos__";
const SEM_CATEGORIA = "__sem_cat__";

type SortKey = "descricao_asc" | "valor_desc" | "valor_asc" | "inicio_desc";

const SORT_LABELS: Record<SortKey, string> = {
  descricao_asc: "Descrição (A→Z)",
  valor_desc: "Valor mensal (maior)",
  valor_asc: "Valor mensal (menor)",
  inicio_desc: "Início da vigência (mais recente)",
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

type Props = {
  linhas: LinhaAssinatura[];
  cartaoOptions: CartaoOpcaoRel[];
  categoriaOptions: CategoriaOpcao[];
  mesLabel: string;
};

export function RelatorioAssinaturasClient({
  linhas,
  cartaoOptions,
  categoriaOptions,
  mesLabel,
}: Props) {
  const [cartaoId, setCartaoId] = useState<string>(TODOS);
  const [categoriaId, setCategoriaId] = useState<string>(TODOS);
  const [status, setStatus] = useState<string>(TODOS);
  const [sort, setSort] = useState<SortKey>("valor_desc");

  const filtradas = useMemo(() => {
    let arr = linhas;
    if (cartaoId !== TODOS) arr = arr.filter((l) => l.cartaoId === cartaoId);
    if (categoriaId !== TODOS) {
      if (categoriaId === SEM_CATEGORIA)
        arr = arr.filter((l) => !l.categoriaId);
      else arr = arr.filter((l) => l.categoriaId === categoriaId);
    }
    if (status !== TODOS) arr = arr.filter((l) => l.status === status);

    const sorted = [...arr];
    switch (sort) {
      case "valor_desc":
        sorted.sort((a, b) => b.valorMensal - a.valorMensal);
        break;
      case "valor_asc":
        sorted.sort((a, b) => a.valorMensal - b.valorMensal);
        break;
      case "inicio_desc":
        sorted.sort((a, b) => b.inicioVigencia.localeCompare(a.inicioVigencia));
        break;
      case "descricao_asc":
      default:
        sorted.sort((a, b) => a.descricao.localeCompare(b.descricao));
        break;
    }
    return sorted;
  }, [linhas, cartaoId, categoriaId, status, sort]);

  const totalAssinaturas = filtradas.length;
  const ativasNoMes = filtradas.filter((l) => l.contaNoMes);
  const totalMensal = ativasNoMes.reduce((s, l) => s + l.valorMensal, 0);
  const totalAnual = totalMensal * 12;

  const algumFiltroAtivo =
    cartaoId !== TODOS || categoriaId !== TODOS || status !== TODOS;

  const limparFiltros = () => {
    setCartaoId(TODOS);
    setCategoriaId(TODOS);
    setStatus(TODOS);
  };

  const cartaoSelecionado = cartaoOptions.find((c) => c.id === cartaoId);
  const categoriaSelecionada = categoriaOptions.find(
    (c) => c.id === categoriaId,
  );

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 p-4 md:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <Label
                htmlFor="f-cartao"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Cartão
              </Label>
              <Select
                value={cartaoId}
                onValueChange={(v) => v && setCartaoId(v)}
              >
                <SelectTrigger id="f-cartao" className="w-full">
                  <SelectValue>
                    {cartaoSelecionado ? (
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <BancoIcone
                          icone={cartaoSelecionado.bancoIcone}
                          corFallback={cartaoSelecionado.bancoCor}
                          nomeFallback={cartaoSelecionado.bancoNome}
                          size={18}
                        />
                        <span className="truncate">
                          {cartaoSelecionado.label}
                        </span>
                      </span>
                    ) : (
                      <span>Todos os cartões</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os cartões</SelectItem>
                  {cartaoOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <BancoIcone
                          icone={c.bancoIcone}
                          corFallback={c.bancoCor}
                          nomeFallback={c.bancoNome}
                          size={18}
                        />
                        <span>{c.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
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
                  <SelectItem value={SEM_CATEGORIA}>
                    <span className="text-muted-foreground">
                      Sem categoria
                    </span>
                  </SelectItem>
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

            <div className="flex min-w-[150px] flex-col gap-1.5">
              <Label
                htmlFor="f-status"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v)}
              >
                <SelectTrigger id="f-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  <SelectItem value="ativa">Ativas</SelectItem>
                  <SelectItem value="futura">Futuras</SelectItem>
                  <SelectItem value="encerrada">Encerradas</SelectItem>
                  <SelectItem value="pausada">Pausadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-[220px] flex-col gap-1.5">
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
            <strong className="text-foreground">{totalAssinaturas}</strong>{" "}
            {totalAssinaturas === 1 ? "assinatura" : "assinaturas"}
            {linhas.length !== totalAssinaturas
              ? ` de ${linhas.length} no total`
              : ""}
            .
          </p>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumoCard
          label="Assinaturas exibidas"
          valor={String(totalAssinaturas)}
          hint={`${ativasNoMes.length} ${ativasNoMes.length === 1 ? "ativa em" : "ativas em"} ${mesLabel}`}
        />
        <ResumoCard
          label={`Valor mensal em ${mesLabel}`}
          valor={formatBRL(totalMensal)}
          destaque
        />
        <ResumoCard
          label="Projeção anual"
          valor={formatBRL(totalAnual)}
          hint="mensal × 12"
        />
      </div>

      {filtradas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma assinatura corresponde aos filtros.
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
                    Assinatura
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Cartão</th>
                  <th className="px-4 py-3 text-left font-medium">Vigência</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Valor / mês
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtradas.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{l.descricao}</span>
                        {l.categoria && (
                          <span className="mt-0.5 text-xs text-muted-foreground">
                            {l.categoria}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BancoIcone
                          icone={l.bancoIcone}
                          corFallback={l.bancoCor}
                          nomeFallback={l.bancoNome}
                          size={24}
                        />
                        <span className="truncate">{l.cartaoLabel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDataBR(l.inicioVigencia)}
                      {l.fimVigencia
                        ? ` → ${formatDataBR(l.fimVigencia)}`
                        : " → em aberto"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={l.status} />
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        l.contaNoMes ? "font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {formatBRL(l.valorMensal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col divide-y divide-border/60 md:hidden">
            {filtradas.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start gap-3">
                  <BancoIcone
                    icone={l.bancoIcone}
                    corFallback={l.bancoCor}
                    nomeFallback={l.bancoNome}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {l.descricao}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.cartaoLabel}
                      {l.categoria ? ` · ${l.categoria}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Vigência
                    </p>
                    <p className="tabular-nums">
                      {formatDataBR(l.inicioVigencia)}
                      {l.fimVigencia
                        ? ` → ${formatDataBR(l.fimVigencia)}`
                        : " → em aberto"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Valor / mês
                    </p>
                    <p
                      className={`tabular-nums font-medium ${
                        l.contaNoMes ? "" : "text-muted-foreground"
                      }`}
                    >
                      {formatBRL(l.valorMensal)}
                    </p>
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

function StatusBadge({ status }: { status: LinhaAssinatura["status"] }) {
  if (status === "ativa")
    return (
      <Badge variant="secondary" className="text-[10px]">
        ativa
      </Badge>
    );
  if (status === "futura")
    return (
      <Badge variant="neutral" className="text-[10px]">
        futura
      </Badge>
    );
  if (status === "encerrada")
    return (
      <Badge variant="neutral" className="text-[10px]">
        encerrada
      </Badge>
    );
  return (
    <Badge variant="neutral" className="text-[10px]">
      pausada
    </Badge>
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
          className={`font-heading tabular-nums ${
            destaque ? "text-primary" : ""
          }`}
          style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", lineHeight: 1 }}
        >
          {valor}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
