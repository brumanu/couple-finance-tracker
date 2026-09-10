import type { Metadata, Viewport } from "next";
import { Figtree, Caprasimo } from "next/font/google";
import "./globals.css";
import { ThemeInitScript } from "@/components/nav/theme-init";
import { COR_BARRA_STATUS } from "@/lib/tema";

const figtree = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caprasimo = Caprasimo({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  // Cada página exporta só o próprio nome; é o que aparece na janela do app
  // no desktop, no histórico e no seletor de abas.
  title: {
    default: "Financeiro do Casal",
    template: "%s — Financeiro",
  },
  description: "Controle financeiro quinzenal do casal",
  applicationName: "Financeiro",
  appleWebApp: {
    capable: true,
    title: "Financeiro",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Seguem o tema do sistema; o tema escolhido no app passa na frente pelo
  // theme-init (ver src/lib/tema.ts).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: COR_BARRA_STATUS.light },
    { media: "(prefers-color-scheme: dark)", color: COR_BARRA_STATUS.dark },
  ],
  width: "device-width",
  initialScale: 1,
  // Sem isso env(safe-area-inset-*) é sempre 0 no iOS em modo standalone, e a
  // barra de gestos do iPhone cobre os rótulos do bottom-nav.
  viewportFit: "cover",
  // No Android o teclado encolhe a página em vez de cobri-la: o que é sticky
  // no rodapé (o campo do mercado) fica logo acima do teclado. O bottom-nav,
  // que subiria junto, some enquanto se digita (TecladoVirtual). O iOS
  // ignora a chave e segue cobrindo.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${caprasimo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
