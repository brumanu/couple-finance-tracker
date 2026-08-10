"use client";

import { useLinkStatus } from "next/link";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

// Deve ser renderizado DENTRO de um <Link>. useLinkStatus dispara pending
// enquanto a navegação está acontecendo (fetch da rota, streaming, etc).
export function LinkPendingDot({ className }: Props) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2Icon
      className={cn("size-3 animate-spin text-muted-foreground", className)}
    />
  );
}
