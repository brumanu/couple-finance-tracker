import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

async function loadCaprasimo() {
  const p = path.join(process.cwd(), "src/app/_fonts/Caprasimo-Regular.ttf");
  return fs.readFile(p);
}

/**
 * O "R$" em Caprasimo sobre o terracota — desenho único dos ícones do app.
 *
 * `raio` só vale pro ícone "any" (aba do navegador, desktop), que é mostrado
 * como está. iOS e Android aplicam a própria máscara por cima: lá o fundo tem
 * que ser um quadrado cheio, porque canto transparente vira preto no iPhone e
 * moldura branca no Android.
 */
export async function renderIconeApp({
  tamanho,
  fonte,
  raio = 0,
}: {
  tamanho: number;
  fonte: number;
  raio?: number;
}) {
  const fontData = await loadCaprasimo();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c67139",
          borderRadius: raio,
          color: "#f5ead8",
          fontFamily: "Caprasimo",
          fontSize: fonte,
          letterSpacing: "-0.03em",
        }}
      >
        R$
      </div>
    ),
    {
      width: tamanho,
      height: tamanho,
      fonts: [
        { name: "Caprasimo", data: fontData, style: "normal", weight: 400 },
      ],
    },
  );
}
