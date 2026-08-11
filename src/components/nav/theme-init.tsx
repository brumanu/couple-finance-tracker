// Script inline que roda ANTES do body renderizar — decide se
// aplica .dark no <html> baseado em localStorage "theme" ou na
// preferência do sistema. Evita flash de tema errado.

const CODE = `(() => {
  try {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    if (isDark) document.documentElement.classList.add("dark");
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
