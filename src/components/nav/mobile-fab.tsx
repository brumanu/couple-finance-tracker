"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DespesaFormDialog } from "@/app/(app)/despesas/despesa-form-dialog";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import type { CategoriaOpcao } from "@/lib/categorias";

type Props = {
  cartoes: CartaoOpcao[];
  categorias: CategoriaOpcao[];
};

export function MobileFab({ cartoes, categorias }: Props) {
  return (
    <div className="fixed bottom-24 right-5 z-40 md:hidden">
      <DespesaFormDialog
        cartoes={cartoes}
        categorias={categorias}
        trigger={
          <Button
            size="icon-lg"
            className="size-14 shadow-[0_12px_32px_color-mix(in_srgb,var(--organic-neutral-900)_28%,transparent)]"
            aria-label="Lançar despesa"
          >
            <PlusIcon className="size-6" strokeWidth={2.75} />
          </Button>
        }
      />
    </div>
  );
}
