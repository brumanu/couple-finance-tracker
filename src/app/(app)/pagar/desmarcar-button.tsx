"use client";

import { useTransition } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desmarcarPagamento } from "./actions";

type Props = {
  lancamentoId: string;
  descricao: string;
};

export function DesmarcarButton({ lancamentoId, descricao }: Props) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm(`Desmarcar pagamento de "${descricao}"?`)) return;
    startTransition(async () => {
      await desmarcarPagamento(lancamentoId);
    });
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      disabled={pending}
      title="Desmarcar pagamento"
      aria-label="Desmarcar pagamento"
    >
      <XIcon className="size-3.5" />
    </Button>
  );
}
