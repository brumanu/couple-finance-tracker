"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useSearch } from "./search-provider";

// O dialog de busca puxa Dialog + ícones + as 6 queries; como fica no layout,
// entrava no bundle de toda rota sem nunca ter sido aberto. Só carrega na
// primeira vez que o usuário abre (⌘K ou o botão de buscar).
const GlobalSearchDialog = dynamic(
  () => import("./global-search-dialog").then((m) => m.GlobalSearchDialog),
  { ssr: false },
);

export function GlobalSearchMount() {
  const { open } = useSearch();
  // Ajuste de estado durante o render (mesmo padrão de useResetAoAbrir):
  // depois de aberto uma vez, o dialog fica montado pro resto da sessão.
  const [jaAbriu, setJaAbriu] = useState(false);
  if (open && !jaAbriu) setJaAbriu(true);

  return jaAbriu ? <GlobalSearchDialog /> : null;
}
