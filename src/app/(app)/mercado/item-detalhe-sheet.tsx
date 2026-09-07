"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoForm } from "@/components/form-dialog-shell";
import { parseBRLInput } from "@/lib/format";
import type { ItemMercado } from "@/lib/mercado";

type Props = {
  item: ItemMercado | null;
  aoFechar: () => void;
  aoSalvar: (mudanca: {
    nome: string;
    quantidade: string | null;
    preco: number | null;
  }) => void;
  aoRemover: () => void;
};

/**
 * Quantidade, preço e remover — tudo o que não cabe na linha do corredor.
 *
 * Fica atrás do botão de reticências de propósito: a linha precisa continuar
 * sendo uma lista de nomes com alvo de toque grande, e o preço é opcional. Um
 * campo de preço em cada uma das 30 linhas seria poluição pra quem não anota.
 *
 * Salva no cliente e volta — não há server action aqui. A mudança entra na
 * fila como qualquer toque e sobe no próximo flush.
 */
export function ItemDetalheSheet({ item, aoFechar, aoSalvar, aoRemover }: Props) {
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [preco, setPreco] = useState("");
  const [idCarregado, setIdCarregado] = useState<string | null>(null);

  // Estado derivado da prop, ajustado durante o render — mesmo padrão do
  // `useResetAoAbrir` dos form-dialogs, sem o render em cascata do useEffect.
  if (item && item.id !== idCarregado) {
    setIdCarregado(item.id);
    setNome(item.nome);
    setQuantidade(item.quantidade ?? "");
    setPreco(item.preco != null ? String(item.preco).replace(".", ",") : "");
  }

  const precoInvalido =
    preco.trim().length > 0 && parseBRLInput(preco) === null;
  const nomeVazio = nome.trim().length === 0;

  function salvar() {
    if (nomeVazio || precoInvalido) return;
    aoSalvar({
      nome: nome.trim(),
      quantidade: quantidade.trim() || null,
      preco: preco.trim() ? parseBRLInput(preco) : null,
    });
    aoFechar();
  }

  return (
    <Dialog
      open={item != null}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setIdCarregado(null);
          aoFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar item</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <CampoForm htmlFor="item_nome" rotulo="Nome">
            <Input
              id="item_nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-invalid={nomeVazio}
            />
          </CampoForm>

          <div className="grid grid-cols-2 gap-3">
            <CampoForm htmlFor="item_quantidade" rotulo="Quantidade">
              <Input
                id="item_quantidade"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="Ex: 2x, 5kg"
              />
            </CampoForm>

            <CampoForm htmlFor="item_preco" rotulo="Preço (opcional)">
              <Input
                id="item_preco"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="Ex: 12,90"
                aria-invalid={precoInvalido}
              />
            </CampoForm>
          </div>

          {precoInvalido && (
            <p className="text-xs text-destructive">
              Preço inválido. Use o formato 12,90.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            O preço é opcional. Se você anotar em todos os itens do carrinho, o
            total da compra já vem somado no fechamento.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              aoRemover();
              aoFechar();
            }}
          >
            <Trash2Icon className="size-4" />
            Remover
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={salvar}
              disabled={nomeVazio || precoInvalido}
            >
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
