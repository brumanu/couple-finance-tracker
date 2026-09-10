import { renderIconeApp } from "@/lib/icone-app";

// Ícone "maskable" do manifesto: o Android recorta no formato do launcher
// (círculo, gota, squircle). Só o círculo central de 80% é garantido de
// aparecer, então o "R$" é menor que no ícone "any" pra caber nele.
// Sem esta versão, o Android encolhia o ícone dentro de uma moldura branca.
//
// Público na proxy pelo prefixo "/icon" (src/lib/supabase/middleware.ts) —
// o navegador busca ícones do manifesto sem cookie.

// Gerado uma vez no build, como o /icon e o /apple-icon.
export const dynamic = "force-static";

export async function GET() {
  return renderIconeApp({ tamanho: 512, fonte: 208 });
}
