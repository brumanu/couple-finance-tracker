"use client";

import dynamic from "next/dynamic";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogSobDemanda } from "@/lib/dialog-sob-demanda";

const Dialog = dynamic(() =>
  import("./pagamento-form-dialog").then((m) => m.PagamentoFormDialog),
);

function BotaoNovoPagamento({ onClick }: { onClick?: () => void }) {
  return (
    <Button size="sm" onClick={onClick}>
      <PlusIcon className="size-4" strokeWidth={2.75} />
      Novo pagamento
    </Button>
  );
}

export function PagamentoBotao(props: {
  dividaId: string;
  restante: number;
}) {
  const { montado, montar, desmontar } = useDialogSobDemanda();

  if (!montado) return <BotaoNovoPagamento onClick={montar} />;

  return (
    <Dialog
      {...props}
      defaultOpen
      onClose={desmontar}
      trigger={<BotaoNovoPagamento />}
    />
  );
}
