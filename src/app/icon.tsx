import { renderIconeApp } from "@/lib/icone-app";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Ícone "any": aba do navegador e app instalado no desktop, onde ninguém
// aplica máscara — por isso os cantos arredondados vêm no próprio desenho.
export default function Icon() {
  return renderIconeApp({ tamanho: 512, fonte: 240, raio: 118 });
}
