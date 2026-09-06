"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CartaoOpcao } from "@/lib/cartoes-selection";
import type { CategoriaOpcao } from "@/lib/categorias";
import type { MembroOpcao } from "@/lib/membros";

// O dialog arrasta Select, Dialog e floating-ui junto (~150 KB). Como o FAB
// vive no layout, isso entrava no bundle inicial de TODAS as rotas mesmo
// fechado. Agora só baixa no primeiro toque.
const DespesaFormDialog = dynamic(
  () =>
    import("@/app/(app)/despesas/despesa-form-dialog").then(
      (m) => m.DespesaFormDialog,
    ),
  { ssr: false },
);

type Props = {
  cartoes: CartaoOpcao[];
  categorias: CategoriaOpcao[];
  membros: MembroOpcao[];
};

export function MobileFab({ cartoes, categorias, membros }: Props) {
  const [carregado, setCarregado] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex justify-end pr-4 md:hidden">
      {carregado ? (
        <DespesaFormDialog
          cartoes={cartoes}
          categorias={categorias}
          membros={membros}
          defaultOpen
          onClose={() => setCarregado(false)}
          trigger={<FabButton />}
        />
      ) : (
        <FabButton onClick={() => setCarregado(true)} />
      )}
    </div>
  );
}

function FabButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      size="icon-lg"
      onClick={onClick}
      className="pointer-events-auto size-[60px] shadow-organic-md"
      aria-label="Lançar despesa"
    >
      <PlusIcon className="size-6" strokeWidth={2.75} />
    </Button>
  );
}
