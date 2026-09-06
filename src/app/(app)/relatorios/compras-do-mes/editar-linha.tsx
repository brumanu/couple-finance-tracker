"use client";

import dynamic from "next/dynamic";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CategoriaOpcao } from "@/lib/categorias";
import type { MembroOpcao } from "@/lib/membros";
import { useDialogSobDemanda } from "@/lib/dialog-sob-demanda";
import type { LinhaCompra } from "./relatorio-client";

/**
 * O lápis das linhas deste relatório.
 *
 * É a única tela que mistura os quatro tipos de lançamento numa lista só, e
 * ela importava os quatro formulários de uma vez — por isso era a rota mais
 * pesada do app (258 KB gz). Aqui os quatro entram por `next/dynamic` e só o
 * formulário do tipo clicado é baixado.
 *
 * Não dá pra usar o `criarDialogDeLista` aqui porque cada tipo de linha leva
 * props diferentes (a compra precisa do fechamento/vencimento do cartão dela,
 * a assinatura do id do cartão), e esses dados vêm da própria linha.
 */

const FormDespesa = dynamic(() =>
  import("../../despesas/despesa-form-dialog").then((m) => m.DespesaFormDialog),
);
const FormRecorrente = dynamic(() =>
  import("../../recorrentes/recorrente-form-dialog").then(
    (m) => m.RecorrenteFormDialog,
  ),
);
const FormCompra = dynamic(() =>
  import("../../cartoes/[id]/compra-form-dialog").then(
    (m) => m.CompraFormDialog,
  ),
);
const FormAssinatura = dynamic(() =>
  import("../../cartoes/[id]/assinatura-form-dialog").then(
    (m) => m.AssinaturaFormDialog,
  ),
);

function BotaoEditar({ onClick }: { onClick?: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={onClick}>
      <PencilIcon className="size-4" strokeWidth={2.75} />
    </Button>
  );
}

export function EditarLinha({
  linha,
  categorias,
  membros,
}: {
  linha: LinhaCompra;
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
}) {
  const { montado, montar, desmontar } = useDialogSobDemanda();

  if (!montado) return <BotaoEditar onClick={montar} />;

  const comum = {
    categorias,
    membros,
    defaultOpen: true as const,
    onClose: desmontar,
    trigger: <BotaoEditar />,
  };

  switch (linha.tipo) {
    case "despesa":
      return <FormDespesa despesa={linha.despesa} {...comum} />;
    case "conta_fixa":
      return <FormRecorrente recorrente={linha.recorrente} {...comum} />;
    case "compra_cartao":
      return (
        <FormCompra
          compra={linha.compra}
          cartaoId={linha.compra.cartao_id}
          diaFechamento={linha.diaFechamento}
          diaVencimento={linha.diaVencimento}
          {...comum}
        />
      );
    case "assinatura":
      return (
        <FormAssinatura
          assinatura={linha.assinatura}
          cartaoId={linha.assinatura.cartao_id}
          {...comum}
        />
      );
  }
}
