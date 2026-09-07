"use client";

import { useMemo, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filtrarSugestoes, parseItem } from "@/lib/mercado";

type Props = {
  /** Nomes já usados pelo casal, do mais frequente pro menos. */
  historico: readonly string[];
  /** Nomes que já estão na lista atual — não se sugere o que já está lá. */
  naLista: readonly string[];
  aoAdicionar: (nome: string, quantidade: string | null) => void;
};

/**
 * O campo fixo no rodapé da tela do corredor.
 *
 * Duas coisas o fazem servir pra quem está andando no mercado: ele **não
 * perde o foco** depois do Enter (a pessoa lembra de três coisas seguidas e
 * digita as três sem tocar em nada), e as sugestões são filtradas no cliente
 * a partir do histórico carregado de uma vez — digitar nunca vai ao servidor,
 * que é o que salva a tela quando o sinal está ruim.
 */
export function CampoAdicionarItem({
  historico,
  naLista,
  aoAdicionar,
}: Props) {
  const [texto, setTexto] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sugestoes = useMemo(
    () => filtrarSugestoes(historico, texto, naLista),
    [historico, texto, naLista],
  );

  function enviar(valor: string) {
    const item = parseItem(valor);
    if (!item) return;
    aoAdicionar(item.nome, item.quantidade);
    setTexto("");
    // Devolve o foco pro campo: a próxima coisa que a pessoa faz é digitar o
    // item seguinte, não procurar onde clicar.
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      {sugestoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => enviar(s)}
              className={cn(
                "rounded-full border border-border/70 bg-card px-3 py-1.5",
                "text-sm transition-colors hover:bg-foreground/5 active:bg-foreground/10",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="flex gap-2"
      >
        <Input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Adicionar item…"
          // `enterKeyHint` troca o botão do teclado do celular de "ir" pra
          // "próximo", que é o que a pessoa realmente vai fazer.
          enterKeyHint="done"
          autoComplete="off"
          className="h-12 flex-1 text-base"
          aria-label="Adicionar item à lista"
        />
        <Button
          type="submit"
          size="icon-lg"
          disabled={!texto.trim()}
          aria-label="Adicionar"
        >
          <PlusIcon className="size-5" strokeWidth={2.75} />
        </Button>
      </form>
    </div>
  );
}
