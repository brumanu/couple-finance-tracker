"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { desmarcarPagamento } from "./actions";

type Props = {
  lancamentoId: string;
  descricao: string;
};

export function DesmarcarButton({ lancamentoId, descricao }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        className="min-h-11 min-w-11"
        onClick={() => setConfirmOpen(true)}
        title="Desmarcar pagamento"
        aria-label="Desmarcar pagamento"
      >
        <XIcon className="size-3.5" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Desmarcar pagamento"
        description={`Desmarcar pagamento de "${descricao}"?`}
        confirmLabel="Desmarcar"
        onConfirm={async () => {
          const result = await desmarcarPagamento(lancamentoId);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Pagamento desmarcado.");
        }}
      />
    </>
  );
}
