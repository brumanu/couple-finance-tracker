"use client";

import dynamic from "next/dynamic";
import { Fragment, useState, useTransition } from "react";
import { MoreVerticalIcon, TrashIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// O menu aparece em toda linha de toda lista, mas a confirmação só é usada
// quando alguém clica em "Excluir". Carregada sob demanda, ela tira o Dialog
// do bundle inicial das rotas de lista.
const ConfirmDialog = dynamic(() =>
  import("@/components/ui/confirm-dialog").then((m) => m.ConfirmDialog),
);

/** O que uma Server Action de mutação devolve quando não é de formulário. */
type ResultadoAcao = { error?: string } | void | undefined;

export type ItemMenu = {
  rotulo: string;
  icone: LucideIcon;
  acao: () => Promise<ResultadoAcao>;
  /** Toast quando dá certo. */
  sucesso: string;
  /** Presente = passa por um ConfirmDialog antes de executar. */
  confirmar?: {
    titulo: string;
    descricao: string;
    rotuloConfirmar?: string;
  };
  /** Pinta em vermelho e entra depois de um separador. */
  destrutivo?: boolean;
};

type Props = {
  itens: ItemMenu[];
  /** `icon-sm` nas listas densas, `sm` onde havia respiro. */
  size?: "sm" | "icon-sm";
  rotulo?: string;
};

/**
 * O menu "⋮" das listas.
 *
 * Os 12 menus da aplicação eram o mesmo componente com o texto trocado:
 * trigger fantasma, um ou dois itens, separador, "Excluir" em vermelho e um
 * `ConfirmDialog` por ação perigosa — cada um repetindo o `try/toast.error`.
 *
 * Além de encurtar, isso conserta duas inconsistências que a revisão apontou:
 * o item de excluir aparecia ora como `text-primary` (o laranja da marca) ora
 * como `text-red-600` (um vermelho fora da paleta); e alguns itens não
 * checavam `result?.error`, engolindo a falha em silêncio. Agora todo item
 * passa pelo mesmo caminho.
 */
export function EntityActionsMenu({
  itens,
  size = "icon-sm",
  rotulo = "Mais opções",
}: Props) {
  const [pending, startTransition] = useTransition();
  // Índice do item cujo ConfirmDialog está aberto; null = nenhum.
  const [confirmando, setConfirmando] = useState<number | null>(null);
  // Depois da primeira confirmação os dialogs ficam montados, pra a animação
  // de fechar continuar existindo. Antes disso nem o módulo é baixado.
  const [jaUsou, setJaUsou] = useState(false);

  function executar(item: ItemMenu) {
    startTransition(async () => {
      const resultado = await item.acao();
      if (resultado?.error) {
        toast.error(resultado.error);
        return;
      }
      toast.success(item.sucesso);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size={size}
              aria-label={rotulo}
              disabled={pending}
            >
              <MoreVerticalIcon className="size-4" strokeWidth={2.75} />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {itens.map((item, i) => {
            const Icone = item.icone;
            // Separador antes do primeiro destrutivo, e só se houver algo
            // acima dele pra separar.
            const separar =
              item.destrutivo && i > 0 && !itens[i - 1].destrutivo;
            return (
              <Fragment key={item.rotulo}>
                {separar && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={() => {
                    if (!item.confirmar) {
                      executar(item);
                      return;
                    }
                    setJaUsou(true);
                    setConfirmando(i);
                  }}
                  className={
                    item.destrutivo
                      ? "text-destructive focus:text-destructive"
                      : undefined
                  }
                >
                  <Icone className="size-4" />
                  {item.rotulo}
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        Um ConfirmDialog por item que pede confirmação, controlado por índice.
        Só entram em cena depois do primeiro clique em "Excluir" — dali em
        diante ficam montados, pra não perder a animação de saída. Na prática
        são um ou dois por menu.
      */}
      {jaUsou &&
        itens.map((item, i) =>
          item.confirmar ? (
            <ConfirmDialog
              key={item.rotulo}
              open={confirmando === i}
              onOpenChange={(aberto) => setConfirmando(aberto ? i : null)}
              title={item.confirmar.titulo}
              description={item.confirmar.descricao}
              confirmLabel={item.confirmar.rotuloConfirmar}
              onConfirm={async () => {
                const resultado = await item.acao();
                if (resultado?.error) {
                  toast.error(resultado.error);
                  return;
                }
                toast.success(item.sucesso);
              }}
            />
          ) : null,
        )}
    </>
  );
}

/**
 * Atalho pro caso mais comum: um menu que só tem "Excluir".
 * Sete dos doze menus são exatamente isto.
 */
export function itemExcluir(opcoes: {
  titulo: string;
  descricao: string;
  acao: () => Promise<ResultadoAcao>;
  sucesso: string;
  rotulo?: string;
}): ItemMenu {
  return {
    rotulo: opcoes.rotulo ?? "Excluir",
    icone: TrashIcon,
    acao: opcoes.acao,
    sucesso: opcoes.sucesso,
    destrutivo: true,
    confirmar: { titulo: opcoes.titulo, descricao: opcoes.descricao },
  };
}
