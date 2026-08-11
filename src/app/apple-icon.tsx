import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

async function loadCaprasimo() {
  const p = path.join(process.cwd(), "src/app/_fonts/Caprasimo-Regular.ttf");
  return fs.readFile(p);
}

export default async function AppleIcon() {
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
          borderRadius: 42,
          color: "#f5ead8",
          fontFamily: "Caprasimo",
          fontSize: 84,
          letterSpacing: "-0.03em",
        }}
      >
        R$
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Caprasimo", data: fontData, style: "normal", weight: 400 },
      ],
    },
  );
}
