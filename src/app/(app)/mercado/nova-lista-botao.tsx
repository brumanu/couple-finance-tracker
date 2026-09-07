"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { criarListaMercado } from "./actions";

/**
 * Abre a lista da próxima ida.
 *
 * O `router.refresh()` basta porque a action já revalidou a rota: a página
 * volta a rodar e encontra a lista aberta que acabou de nascer.
 */
export function NovaListaBotao() {
  const router = useRouter();
  const [criando, setCriando] = useState(false);

  async function criar() {
    setCriando(true);
    const resultado = await criarListaMercado();
    setCriando(false);

    if ("error" in resultado) {
      toast.error(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button onClick={criar} disabled={criando} size="lg">
      {criando ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : (
        <PlusIcon className="size-4" strokeWidth={2.75} />
      )}
      Nova lista de mercado
    </Button>
  );
}
