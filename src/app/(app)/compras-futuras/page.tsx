import { ExternalLinkIcon, UserIcon, UsersIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias-server";
import { getMembrosCasal } from "@/lib/membros-server";
import { formatBRL } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QUEM_CASAL, type MembroOpcao } from "@/lib/membros";
import type { CategoriaOpcao } from "@/lib/categorias";
import {
  CompraFuturaFormDialog,
  EditCompraFuturaTrigger,
  type CompraFuturaRow,
} from "./compra-futura-form-dialog";
import { CompraFuturaActionsMenu } from "./compra-futura-actions-menu";
import { CompreiDialog } from "./comprei-dialog";

const GRUPOS = [
  { prioridade: 1, titulo: "Prioridade alta", cor: "bg-primary" },
  { prioridade: 2, titulo: "Prioridade média", cor: "bg-sage-500" },
  { prioridade: 3, titulo: "Um dia", cor: "bg-neutral-400" },
] as const;

function formatDataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default async function ComprasFuturasPage() {
  const supabase = await createClient();

  const [, itensRes, categorias, membros] = await Promise.all([
    requireSession(),
    supabase
      .from("compras_futuras")
      .select(
        "id, descricao, valor_estimado, prioridade, categoria, categoria_id, quem_quer, link, observacao, comprado_em",
      )
      .order("prioridade", { ascending: true })
      .order("created_at", { ascending: false }),
    getCategorias(),
    getMembrosCasal(),
  ]);

  const itens = (itensRes.data ?? []) as CompraFuturaRow[];
  const abertos = itens.filter((i) => !i.comprado_em);
  const comprados = itens.filter((i) => i.comprado_em);

  const totalEstimado = abertos.reduce(
    (s, i) => s + (i.valor_estimado != null ? Number(i.valor_estimado) : 0),
    0,
  );
  const semValor = abertos.filter((i) => i.valor_estimado == null).length;

  const categoriaById = new Map(categorias.map((c) => [c.id, c] as const));
  const membroById = new Map(membros.map((m) => [m.id, m] as const));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
            Quero comprar
          </h2>
          <p className="mt-1.5 max-w-[56ch] text-[15px] text-neutral-700">
            O que vocês querem comprar um dia. Nada aqui entra nas contas do
            mês — só quando você marcar como comprado.
          </p>
        </div>
        <CompraFuturaFormDialog categorias={categorias} membros={membros} />
      </header>

      {itens.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              A lista está vazia. Anote aquele desejo antes que esqueça.
            </p>
            <CompraFuturaFormDialog categorias={categorias} membros={membros} />
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <ResumoCard
              label="Total estimado"
              valor={formatBRL(totalEstimado)}
              hint={
                semValor > 0
                  ? `${semValor} ${semValor === 1 ? "item sem valor" : "itens sem valor"}`
                  : "todos com valor"
              }
              destaque
            />
            <ResumoCard
              label="Na lista"
              valor={String(abertos.length)}
              hint={abertos.length === 1 ? "item" : "itens"}
            />
            <ResumoCard
              label="Já comprados"
              valor={String(comprados.length)}
              hint={comprados.length === 1 ? "item" : "itens"}
            />
          </div>

          {GRUPOS.map((g) => {
            const doGrupo = abertos.filter((i) => i.prioridade === g.prioridade);
            if (doGrupo.length === 0) return null;
            const totalGrupo = doGrupo.reduce(
              (s, i) =>
                s + (i.valor_estimado != null ? Number(i.valor_estimado) : 0),
              0,
            );
            return (
              <section key={g.prioridade} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="flex items-center gap-2 font-heading text-[20px]">
                    <span
                      className={`size-2.5 rounded-full ${g.cor}`}
                      aria-hidden
                    />
                    {g.titulo}
                  </h3>
                  <span className="text-[13px] tabular-nums text-neutral-700">
                    {doGrupo.length}{" "}
                    {doGrupo.length === 1 ? "item" : "itens"}
                    {totalGrupo > 0 && ` · ${formatBRL(totalGrupo)}`}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {doGrupo.map((item) => (
                    <ItemLinha
                      key={item.id}
                      item={item}
                      categoria={
                        item.categoria_id
                          ? categoriaById.get(item.categoria_id)
                          : undefined
                      }
                      membroById={membroById}
                      categorias={categorias}
                      membros={membros}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {comprados.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="px-1 font-heading text-[20px] text-neutral-700">
                Já comprados
              </h3>
              <div className="flex flex-col gap-2.5">
                {comprados.map((item) => (
                  <ItemLinha
                    key={item.id}
                    item={item}
                    categoria={
                      item.categoria_id
                        ? categoriaById.get(item.categoria_id)
                        : undefined
                    }
                    membroById={membroById}
                    categorias={categorias}
                    membros={membros}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ItemLinha({
  item,
  categoria,
  membroById,
  categorias,
  membros,
}: {
  item: CompraFuturaRow;
  categoria: CategoriaOpcao | undefined;
  membroById: Map<string, MembroOpcao>;
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
}) {
  const comprado = Boolean(item.comprado_em);
  const valor = item.valor_estimado != null ? Number(item.valor_estimado) : null;

  const meta: string[] = [];
  if (categoria) meta.push(categoria.nome);
  if (item.observacao) meta.push(item.observacao);

  const quemNome =
    item.quem_quer === QUEM_CASAL
      ? "Casal"
      : item.quem_quer
        ? (membroById.get(item.quem_quer)?.nome ?? null)
        : null;

  return (
    <div
      className={`flex items-center gap-4 rounded-[26px] px-5 py-4 ${
        comprado ? "bg-card/60" : "bg-card"
      }`}
    >
      <div
        className="flex size-[38px] shrink-0 items-center justify-center rounded-full text-sm"
        style={
          categoria
            ? { backgroundColor: categoria.cor, color: "#fff" }
            : undefined
        }
      >
        {categoria ? (
          (categoria.emoji ?? categoria.nome[0]?.toUpperCase() ?? "?")
        ) : (
          <span className="flex size-full items-center justify-center rounded-full bg-neutral-200 font-heading text-foreground">
            {item.descricao[0]?.toUpperCase() ?? "?"}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className={`truncate text-[15px] font-semibold ${
              comprado ? "text-neutral-700 line-through" : ""
            }`}
          >
            {item.descricao}
          </p>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir link do produto"
              className="shrink-0 text-neutral-700 hover:text-foreground"
            >
              <ExternalLinkIcon className="size-3.5" strokeWidth={2.75} />
            </a>
          )}
        </div>
        <p className="truncate text-[13px] text-neutral-700">
          {comprado
            ? `Comprado em ${formatDataCurta(item.comprado_em!)}${meta.length ? " · " + meta.join(" · ") : ""}`
            : (meta.join(" · ") || "Sem categoria")}
        </p>
      </div>

      {quemNome && (
        <Badge variant="neutral" className="hidden shrink-0 text-[10px] sm:inline-flex">
          {item.quem_quer === QUEM_CASAL ? (
            <UsersIcon className="size-3" />
          ) : (
            <UserIcon className="size-3" />
          )}
          {quemNome}
        </Badge>
      )}

      <span
        className={`shrink-0 tabular-nums text-[15px] font-medium ${
          comprado ? "text-neutral-700 line-through" : ""
        }`}
      >
        {valor != null ? (
          formatBRL(valor)
        ) : (
          <span className="text-[13px] font-normal text-muted-foreground">
            a definir
          </span>
        )}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {!comprado && (
          <CompreiDialog
            id={item.id}
            descricao={item.descricao}
            valorEstimado={valor}
          />
        )}
        <EditCompraFuturaTrigger
          item={item}
          categorias={categorias}
          membros={membros}
        />
        <CompraFuturaActionsMenu
          id={item.id}
          descricao={item.descricao}
          comprado={comprado}
        />
      </div>
    </div>
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
          className={`truncate font-heading tabular-nums ${
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
