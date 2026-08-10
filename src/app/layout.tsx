import type { Metadata } from "next";
import { Figtree, Caprasimo } from "next/font/google";
import "./globals.css";

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
  title: "Financeiro do Casal",
  description: "Controle financeiro quinzenal — Bruno & Esposa",
  applicationName: "Financeiro",
  appleWebApp: {
    capable: true,
    title: "Financeiro",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: "#c67139",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${caprasimo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
