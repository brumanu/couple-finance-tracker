import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identidade fixa do app instalado. Sem `id`, o navegador usa o
    // start_url — e mudar o start_url um dia viraria "outro app".
    id: "/",
    name: "Financeiro do Casal",
    short_name: "Financeiro",
    description: "Controle financeiro quinzenal do casal",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Tela de abertura do Android. O manifesto não sabe o tema escolhido no
    // app (ele vive no localStorage), então fica o creme do tema claro.
    background_color: "#f5ead8",
    theme_color: "#c67139",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    // Aparecem ao segurar o ícone do app na tela inicial (Android) ou ao
    // clicar com o botão direito nele (desktop). O iOS não suporta.
    shortcuts: [
      {
        name: "Lançar despesa",
        short_name: "Despesa",
        url: "/despesas?nova=1",
      },
      {
        name: "Lista do mercado",
        short_name: "Mercado",
        url: "/mercado",
      },
      {
        name: "Contas do mês",
        short_name: "Contas",
        url: "/recorrentes",
      },
    ],
  };
}
