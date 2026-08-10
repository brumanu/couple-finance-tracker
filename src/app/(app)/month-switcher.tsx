import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mesAnterior, mesProximo, type MesRef } from "@/lib/mes";

type Props = {
  mes: MesRef;
};

export function MonthSwitcher({ mes }: Props) {
  const prev = mesAnterior(mes);
  const next = mesProximo(mes);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <Link href={`/?mes=${prev.chave}`} aria-label="Mês anterior">
            <ChevronLeftIcon className="size-4" />
          </Link>
        }
      />
      <div className="min-w-36 text-center text-sm font-medium tabular-nums">
        {mes.label}
      </div>
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <Link href={`/?mes=${next.chave}`} aria-label="Próximo mês">
            <ChevronRightIcon className="size-4" />
          </Link>
        }
      />
    </div>
  );
}
