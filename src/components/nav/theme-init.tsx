// Script inline que roda ANTES do body renderizar — decide se
// aplica .dark no <html> baseado em localStorage "theme" ou na
// preferência do sistema. Evita flash de tema errado.
//
// Com tema escolhido no app, também fixa a cor da barra de status nele (ver
// ID_META_TEMA). Sem escolha, os metas do layout seguem o sistema sozinhos.

import { COR_BARRA_STATUS, ID_META_TEMA } from "@/lib/tema";

const CODE = `(() => {
  try {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    if (isDark) document.documentElement.classList.add("dark");
    if (stored === "light" || stored === "dark") {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.id = ${JSON.stringify(ID_META_TEMA)};
      meta.content = ${JSON.stringify(COR_BARRA_STATUS)}[stored];
      document.head.prepend(meta);
    }
  } catch {}
})();`;

export function ThemeInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: CODE }}
      suppressHydrationWarning
    />
  );
}
