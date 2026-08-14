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

export type LinhaRelatorio = {
  id: string;
  descricao: string;
  categoria: string | null;
  categoriaId: string | null;
  cartaoId: string;
  cartaoLabel: string;
  bancoIcone: string | null;
  bancoCor: string;
  bancoNome: string;
  dataCompra: string;
  valorTotal: number;
  parcelas: number;
  parcelaAtual: number;
  valorParcela: number;
  valorUltimaParcela: number;
  faltaPagar: number;
  parcelasRestantes: number;
  primeiraChave: string;
  primeiraLabel: string;
  ultimaChave: string;
  ultimaLabel: string;
  ultimaAno: number;
  ultimaMes: number;
  status: "aguardando" | "ativa" | "quitada";
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

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function labelMesAbrev(ano: number, mes: number): string {
  return `${MESES_ABREV[mes - 1]}/${String(ano).slice(2)}`;
}

function parseChave(chave: string): { ano: number; mes: number } {
  const [ano, mes] = chave.split("-").map(Number);
  return { ano, mes };
}

function proximoMes(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

type SortKey =
  | "data_desc"
  | "data_asc"
  | "falta_desc"
  | "valor_desc"
  | "ultima_asc";

const SORT_LABELS: Record<SortKey, string> = {
  data_desc: "Data da compra (recentes)",
  data_asc: "Data da compra (antigas)",
  falta_desc: "Falta pagar (maior)",
  valor_desc: "Valor total (maior)",
  ultima_asc: "Última parcela (próximas)",
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

type Props = {
  linhas: LinhaRelatorio[];
  cartaoOptions: CartaoOpcaoRel[];
  categoriaOptions: CategoriaOpcao[];
};

export function RelatorioComprasParceladasClient({
  linhas,
  cartaoOptions,
  categoriaOptions,
}: Props) {
  const [cartaoId, setCartaoId] = useState<string>(TODOS);
  const [categoriaId, setCategoriaId] = useState<string>(TODOS);
  const [status, setStatus] = useState<string>(TODOS);
  const [mes, setMes] = useState<string>(TODOS);
  const [sort, setSort] = useState<SortKey>("data_desc");

  const mesOptions = useMemo(() => {
    const chaves = new Set<string>();
    for (const l of linhas) {
      let { ano, mes: m } = parseChave(l.primeiraChave);
      let chave = `${ano}-${pad2(m)}`;
      while (chave <= l.ultimaChave) {
        chaves.add(chave);
        ({ ano, mes: m } = proximoMes(ano, m));
        chave = `${ano}-${pad2(m)}`;
      }
    }
    return Array.from(chaves)
      .sort()
      .map((chave) => {
        const { ano, mes: m } = parseChave(chave);
        return { chave, label: labelMesAbrev(ano, m) };
      });
  }, [linhas]);

  const filtradas = useMemo(() => {
    let arr = linhas;
    if (cartaoId !== TODOS) arr = arr.filter((l) => l.cartaoId === cartaoId);
    if (categoriaId !== TODOS) {
      if (categoriaId === SEM_CATEGORIA)
        arr = arr.filter((l) => !l.categoriaId);
      else arr = arr.filter((l) => l.categoriaId === categoriaId);
    }
    if (status !== TODOS) arr = arr.filter((l) => l.status === status);
    if (mes !== TODOS)
      arr = arr.filter((l) => l.primeiraChave <= mes && mes <= l.ultimaChave);

    const sorted = [...arr];
    switch (sort) {
      case "data_asc":
        sorted.sort((a, b) => a.dataCompra.localeCompare(b.dataCompra));
        break;
      case "falta_desc":
        sorted.sort((a, b) => b.faltaPagar - a.faltaPagar);
        break;
      case "valor_desc":
        sorted.sort((a, b) => b.valorTotal - a.valorTotal);
        break;
      case "ultima_asc":
        sorted.sort((a, b) => a.ultimaChave.localeCompare(b.ultimaChave));
        break;
      case "data_desc":
      default:
        sorted.sort((a, b) => b.dataCompra.localeCompare(a.dataCompra));
        break;
    }
    return sorted;
  }, [linhas, cartaoId, categoriaId, status, mes, sort]);

  const totalCompras = filtradas.length;
  const totalFalta = filtradas.reduce((s, l) => s + l.faltaPagar, 0);
  const totalOriginal = filtradas.reduce((s, l) => s + l.valorTotal, 0);

  const projecao = useMemo(() => {
    type Bucket = {
      chave: string;
      ano: number;
      mes: number;
      label: string;
      encerramentos: number;
      valorUltimaParcela: number;
      liberadoAcumulado: number;
    };
    const map = new Map<string, Bucket>();
    for (const l of filtradas) {
      if (l.status === "quitada") continue;
      const chave = l.ultimaChave;
      let b = map.get(chave);
      if (!b) {
        b = {
          chave,
          ano: l.ultimaAno,
          mes: l.ultimaMes,
          label: l.ultimaLabel,
          encerramentos: 0,
          valorUltimaParcela: 0,
          liberadoAcumulado: 0,
        };
        map.set(chave, b);
      }
      b.encerramentos += 1;
      b.valorUltimaParcela += l.valorUltimaParcela;
    }
    const arr = Array.from(map.values()).sort((a, b) =>
      a.chave.localeCompare(b.chave),
    );
    let acc = 0;
    for (const b of arr) {
      b.valorUltimaParcela = Number(b.valorUltimaParcela.toFixed(2));
      acc += b.valorUltimaParcela;
      b.liberadoAcumulado = Number(acc.toFixed(2));
    }
    return arr;
  }, [filtradas]);

  const valorMaximoBarra = projecao.reduce(
    (m, b) => Math.max(m, b.valorUltimaParcela),
    0,
  );

  const algumFiltroAtivo =
    cartaoId !== TODOS ||
    categoriaId !== TODOS ||
    status !== TODOS ||
    mes !== TODOS;

  const limparFiltros = () => {
    setCartaoId(TODOS);
    setCategoriaId(TODOS);
    setStatus(TODOS);
    setMes(TODOS);
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

            <div className="flex min-w-[140px] flex-col gap-1.5">
              <Label
                htmlFor="f-mes"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Mês
              </Label>
              <Select value={mes} onValueChange={(v) => v && setMes(v)}>
                <SelectTrigger id="f-mes" className="w-full">
                  <SelectValue>
                    {mes === TODOS
                      ? "Todos os meses"
                      : (mesOptions.find((m) => m.chave === mes)?.label ??
                        mes)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os meses</SelectItem>
                  {mesOptions.map((m) => (
                    <SelectItem key={m.chave} value={m.chave}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-[140px] flex-col gap-1.5">
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
                  <SelectItem value="aguardando">Aguardando início</SelectItem>
                  <SelectItem value="quitada">Quitadas</SelectItem>
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
                  {(
                    Object.keys(SORT_LABELS) as SortKey[]
                  ).map((k) => (
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
            Mostrando <strong className="text-foreground">{totalCompras}</strong>{" "}
            {totalCompras === 1 ? "compra" : "compras"}
            {linhas.length !== totalCompras
              ? ` de ${linhas.length} no total`
              : ""}
            .
          </p>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumoCard
          label="Total de compras"
          valor={String(totalCompras)}
          hint={totalCompras === 1 ? "compra" : "compras"}
        />
        <ResumoCard
          label="Valor total original"
          valor={formatBRL(totalOriginal)}
        />
        <ResumoCard
          label="Falta pagar"
          valor={formatBRL(totalFalta)}
          destaque
        />
      </div>

      {projecao.length > 0 && (
        <ProjecaoChart projecao={projecao} maximo={valorMaximoBarra} />
      )}

      {filtradas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma compra corresponde aos filtros.
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
                  <th className="px-4 py-3 text-left font-medium">Compra</th>
                  <th className="px-4 py-3 text-left font-medium">Cartão</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">
                    Parcela
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Valor parc.
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Falta pagar
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Última em
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
                      {formatDataBR(l.dataCompra)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatBRL(l.valorTotal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {l.status === "aguardando" ? (
                        <Badge variant="neutral" className="text-[10px]">
                          começa {l.primeiraLabel}
                        </Badge>
                      ) : l.status === "quitada" ? (
                        <Badge variant="secondary" className="text-[10px]">
                          quitada
                        </Badge>
                      ) : (
                        <span className="tabular-nums">
                          {l.parcelaAtual}/{l.parcelas}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatBRL(l.valorParcela)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        l.faltaPagar > 0
                          ? "font-medium text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatBRL(l.faltaPagar)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.ultimaLabel}
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
                    <p className="text-xs text-muted-foreground">
                      {l.cartaoLabel} · {formatDataBR(l.dataCompra)}
                    </p>
                  </div>
                  {l.status === "aguardando" ? (
                    <Badge variant="neutral" className="text-[10px]">
                      {l.primeiraLabel}
                    </Badge>
                  ) : l.status === "quitada" ? (
                    <Badge variant="secondary" className="text-[10px]">
                      quitada
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      {l.parcelaAtual}/{l.parcelas}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Parcela
                    </p>
                    <p className="tabular-nums font-medium">
                      {formatBRL(l.valorParcela)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Falta
                    </p>
                    <p
                      className={`tabular-nums font-medium ${
                        l.faltaPagar > 0 ? "text-primary" : ""
                      }`}
                    >
                      {formatBRL(l.faltaPagar)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Última
                    </p>
                    <p className="font-medium">{l.ultimaLabel}</p>
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

type ProjecaoBucket = {
  chave: string;
  ano: number;
  mes: number;
  label: string;
  encerramentos: number;
  valorUltimaParcela: number;
  liberadoAcumulado: number;
};

function ProjecaoChart({
  projecao,
  maximo,
}: {
  projecao: ProjecaoBucket[];
  maximo: number;
}) {
  const totalEncerramentos = projecao.reduce(
    (s, b) => s + b.encerramentos,
    0,
  );
  const totalLiberado =
    projecao.length > 0
      ? projecao[projecao.length - 1].liberadoAcumulado
      : 0;

  return (
    <Card>
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary">
            Quitações mês a mês
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada barra mostra o valor das últimas parcelas que caem naquele
            mês. A partir do mês seguinte, esse valor deixa de aparecer na
            fatura.
          </p>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-full items-end gap-2 px-1">
            {projecao.map((b) => {
              const alturaPct =
                maximo > 0 ? (b.valorUltimaParcela / maximo) * 100 : 0;
              return (
                <div
                  key={b.chave}
                  className="flex min-w-[64px] flex-1 flex-col items-center gap-1.5"
                  title={`${b.label} — encerra ${formatBRL(b.valorUltimaParcela)} em ${b.encerramentos} ${
                    b.encerramentos === 1 ? "compra" : "compras"
                  } · a partir do mês seguinte fica ${formatBRL(b.liberadoAcumulado)} livre`}
                >
                  <span className="text-[10px] tabular-nums font-medium">
                    {formatBRL(b.valorUltimaParcela).replace("R$ ", "")}
                  </span>
                  <div className="relative flex h-32 w-full items-end overflow-hidden rounded-md bg-muted/60">
                    <div
                      className="w-full rounded-md bg-primary"
                      style={{ height: `${Math.max(2, alturaPct)}%` }}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {b.label}
                    </span>
                    <span className="text-[10px] tabular-nums text-sage-700">
                      +{formatBRL(b.liberadoAcumulado).replace("R$ ", "")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-primary" />
            valor da última parcela do mês
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-sage-500" />
            liberado acumulado
          </span>
          <span>
            {totalEncerramentos}{" "}
            {totalEncerramentos === 1
              ? "quitação prevista"
              : "quitações previstas"}{" "}
            · total{" "}
            <strong className="tabular-nums text-sage-700">
              {formatBRL(totalLiberado)}
            </strong>
          </span>
        </div>
      </div>
    </Card>
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
