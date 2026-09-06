"use client";

import dynamic from "next/dynamic";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogSobDemanda } from "@/lib/dialog-sob-demanda";

/**
 * Os dois botões "Pagar" do dashboard — conta fixa e fatura de cartão.
 *
 * O dashboard mostra um por conta vigente e um por cartão ativo. Com os
 * dialogs importados direto, todos eles iam parar no bundle da rota mais
 * visitada do app; aqui cada um só baixa o formulário quando é clicado.
 */

const DialogConta = dynamic(() =>
  import("./pagar-dialog").then((m) => m.PagarDialog),
);

const DialogFatura = dynamic(() =>
  import("./pagar-fatura-dialog").then((m) => m.PagarFaturaDialog),
);

function BotaoPagar({
  titulo,
  onClick,
}: {
  titulo: string;
  onClick?: () => void;
}) {
  return (
    <Button size="sm" variant="outline" title={titulo} onClick={onClick}>
      <CheckIcon className="size-3.5" />
      Pagar
    </Button>
  );
}

export function PagarConta(props: {
  contaRecorrenteId: string;
  descricao: string;
  valorPrevisto: number | string;
  dataReferencia: string;
  quinzena: 15 | 30;
}) {
  const { montado, montar, desmontar } = useDialogSobDemanda();

  if (!montado) {
    return <BotaoPagar titulo="Marcar como paga" onClick={montar} />;
  }

  // O botão segue no lugar como trigger, pra linha não “piscar” enquanto o
  // dialog está aberto.
  return (
    <DialogConta
      {...props}
      defaultOpen
      onClose={desmontar}
      trigger={<BotaoPagar titulo="Marcar como paga" />}
    />
  );
}

export function PagarFatura(props: {
  cartaoId: string;
  label: string;
  totalFatura: number;
  mesReferencia: string;
}) {
  const { montado, montar, desmontar } = useDialogSobDemanda();

  if (!montado) {
    return <BotaoPagar titulo="Marcar fatura como paga" onClick={montar} />;
  }

  return (
    <DialogFatura
      {...props}
      defaultOpen
      onClose={desmontar}
      trigger={<BotaoPagar titulo="Marcar fatura como paga" />}
    />
  );
}
