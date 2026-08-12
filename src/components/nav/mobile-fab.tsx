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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex justify-end px-5 md:hidden">
      <DespesaFormDialog
        cartoes={cartoes}
        categorias={categorias}
        trigger={
          <Button
            size="icon-lg"
            className="pointer-events-auto size-[60px] shadow-organic-md"
            aria-label="Lançar despesa"
          >
            <PlusIcon className="size-6" strokeWidth={2.75} />
          </Button>
        }
      />
    </div>
  );
}
