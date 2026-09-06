"use client";

import dynamic from "next/dynamic";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogSobDemanda } from "@/lib/dialog-sob-demanda";

const Dialog = dynamic(() =>
  import("./comprei-dialog").then((m) => m.CompreiDialog),
);

function BotaoComprei({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      title="Marcar como comprado"
      onClick={onClick}
    >
      <CheckIcon className="size-3.5" />
      Comprei
    </Button>
  );
}

/** Um por item da lista de desejos — carrega o formulário só no clique. */
export function CompreiBotao(props: {
  id: string;
  descricao: string;
  valorEstimado: number | null;
}) {
  const { montado, montar, desmontar } = useDialogSobDemanda();

  if (!montado) return <BotaoComprei onClick={montar} />;

  return (
    <Dialog
      {...props}
      defaultOpen
      onClose={desmontar}
      trigger={<BotaoComprei />}
    />
  );
}
