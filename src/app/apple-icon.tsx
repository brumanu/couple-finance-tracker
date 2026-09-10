import { renderIconeApp } from "@/lib/icone-app";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Quadrado cheio: o iOS arredonda sozinho, e o canto transparente de um
// desenho já arredondado aparecia preto por baixo da máscara dele.
export default function AppleIcon() {
  return renderIconeApp({ tamanho: 180, fonte: 84 });
}
