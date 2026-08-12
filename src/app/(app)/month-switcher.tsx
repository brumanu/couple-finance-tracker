"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mesAnterior, mesProximo, type MesRef } from "@/lib/mes";

type Props = {
  mes: MesRef;
};

type Direcao = "prev" | "next" | null;

export function MonthSwitcher({ mes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [direcao, setDirecao] = useState<Direcao>(null);

  useEffect(() => {
    if (!isPending) setDirecao(null);
  }, [isPending]);

  const prev = mesAnterior(mes);
  const next = mesProximo(mes);

  function navegar(alvo: string, dir: Direcao) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", alvo);
    setDirecao(dir);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-label="Mês anterior"
        disabled={isPending}
        onClick={() => navegar(prev.chave, "prev")}
      >
        {direcao === "prev" && isPending ? (
          <Loader2Icon className="size-4 animate-spin" strokeWidth={2.75} />
        ) : (
          <ChevronLeftIcon className="size-4" strokeWidth={2.75} />
        )}
      </Button>
      <div
        className={`min-w-36 text-center text-sm font-medium tabular-nums transition-opacity ${
          isPending ? "opacity-50" : ""
        }`}
      >
        {mes.label}
      </div>
      <Button
        variant="outline"
        size="sm"
        aria-label="Próximo mês"
        disabled={isPending}
        onClick={() => navegar(next.chave, "next")}
      >
        {direcao === "next" && isPending ? (
          <Loader2Icon className="size-4 animate-spin" strokeWidth={2.75} />
        ) : (
          <ChevronRightIcon className="size-4" strokeWidth={2.75} />
        )}
      </Button>
    </div>
  );
}
