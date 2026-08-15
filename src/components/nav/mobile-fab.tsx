"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DespesaFormDialog } from "@/app/(app)/despesas/despesa-form-dialog";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import type { CategoriaOpcao } from "@/lib/categorias";
import type { MembroOpcao } from "@/lib/membros";

type Props = {
  cartoes: CartaoOpcao[];
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
};

export function MobileFab({ cartoes, categorias, membros }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex justify-center md:hidden">
      <DespesaFormDialog
        cartoes={cartoes}
        categorias={categorias}
        membros={membros}
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
