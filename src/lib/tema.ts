// Cor da barra de status do celular (e da barra de título no desktop) em cada
// tema. Usada no `viewport` do layout, no script de tema que roda antes do
// body e no botão de trocar tema.
export const COR_BARRA_STATUS = {
  light: "#c67139",
  dark: "#1c1714",
} as const;

// O `viewport.themeColor` do layout gera dois <meta name="theme-color"> com
// media query de prefers-color-scheme — seguem o tema do SISTEMA. Quando a
// pessoa escolhe um tema no app, um terceiro meta, sem media e no topo do
// <head>, passa na frente dos dois (o navegador usa o primeiro que casa).
export const ID_META_TEMA = "theme-color-app";
