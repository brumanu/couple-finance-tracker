"use client";

import { useState } from "react";
import { ClipboardListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseBlocoDeItens, type ItemParseado } from "@/lib/mercado";

type Props = {
  naLista: readonly string[];
  aoAdicionar: (itens: ItemParseado[]) => void;
  /** No desktop o bloco já nasce aberto ao lado da lista. */
  abertoPorPadrao?: boolean;
  className?: string;
};

/**
 * Cadastro em massa: uma linha por item, ou separados por vírgula.
 *
 * É o modo da mesa, não o do corredor — no desktop ele fica aberto ao lado da
 * lista; no celular vive recolhido atrás de um botão, pra quando alguém manda
 * a lista pronta por mensagem e a pessoa só quer colar.
 *
 * A prévia embaixo do campo não é enfeite: o parser de quantidade é
 * conservador e às vezes decide que "detergente 3 unidades" é tudo nome. Ver
 * o resultado antes de confirmar é o que evita a surpresa na lista.
 */
export function BlocoDeItens({
  naLista,
  aoAdicionar,
  abertoPorPadrao = false,
  className,
}: Props) {
  const [aberto, setAberto] = useState(abertoPorPadrao);
  const [texto, setTexto] = useState("");

  const previa = texto.trim() ? parseBlocoDeItens(texto, naLista) : [];

  function confirmar() {
    if (previa.length === 0) return;
    aoAdicionar(previa);
    setTexto("");
    if (!abertoPorPadrao) setAberto(false);
  }

  if (!aberto) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAberto(true)}
        className={className}
      >
        <ClipboardListIcon className="size-4" />
        Colar lista
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4",
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-semibold">Cadastrar vários de uma vez</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Um item por linha (ou separados por vírgula). Entende quantidade:
          “2x leite”, “arroz 5kg”.
        </p>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        autoFocus={!abertoPorPadrao}
        placeholder={"arroz 5kg\n2x leite\ncafé\ndetergente"}
        className={cn(
          "w-full resize-y rounded-xl border border-input bg-background px-3 py-2",
          "text-sm outline-none placeholder:text-muted-foreground/70",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        )}
      />

      {texto.trim() && (
        <div className="flex flex-col gap-1.5 text-xs">
          {previa.length === 0 ? (
            <p className="text-muted-foreground">
              Nada novo aqui — esses itens já estão na lista.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                {previa.length === 1
                  ? "1 item novo:"
                  : `${previa.length} itens novos:`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {previa.map((i) => (
                  <span
                    key={i.nome}
                    className="rounded-full bg-foreground/5 px-2.5 py-1"
                  >
                    {i.nome}
                    {i.quantidade && (
                      <span className="ml-1.5 text-muted-foreground">
                        {i.quantidade}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={confirmar} disabled={previa.length === 0}>
          Adicionar {previa.length > 0 && `(${previa.length})`}
        </Button>
        {!abertoPorPadrao && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTexto("");
              setAberto(false);
            }}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
