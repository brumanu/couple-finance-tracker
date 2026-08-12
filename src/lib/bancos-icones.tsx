import * as React from "react";

type RoundelProps = {
  cor: string;
  glifo: string;
  size?: number;
};

export function Roundel({ cor, glifo, size = 28 }: RoundelProps) {
  const twoChars = glifo.length > 1;
  const fs = twoChars ? 15 : 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="20" fill={cor} />
      <text
        x="20"
        y={twoChars ? 25 : 27}
        textAnchor="middle"
        fontFamily="var(--font-heading, Figtree), sans-serif"
        fontWeight="700"
        fontSize={fs}
        fill="#fff"
      >
        {glifo}
      </text>
    </svg>
  );
}

export const BANCO_ICONES = {
  nubank: {
    nome: "Nubank",
    cor: "#820AD1",
    glifo: "n",
  },
  itau: {
    nome: "Itaú",
    cor: "#EC7000",
    glifo: "i",
  },
  picpay: {
    nome: "PicPay",
    cor: "#21C25E",
    glifo: "P",
  },
  mercadopago: {
    nome: "Mercado Pago",
    cor: "#009EE3",
    glifo: "mp",
  },
  c6: {
    nome: "C6 Bank",
    cor: "#242424",
    glifo: "C6",
  },
  inter: {
    nome: "Inter",
    cor: "#FF7A00",
    glifo: "in",
  },
} as const;

export type BancoIconeId = keyof typeof BANCO_ICONES;

export const BANCO_ICONE_IDS = Object.keys(BANCO_ICONES) as BancoIconeId[];

export function isBancoIconeId(v: unknown): v is BancoIconeId {
  return typeof v === "string" && v in BANCO_ICONES;
}

/**
 * Renderiza o roundel do banco no size solicitado.
 * Usa fallback (roundel com iniciais na cor cadastrada) quando o banco
 * ainda não tem icone (dados legados do modelo antigo).
 */
export function BancoIcone({
  icone,
  corFallback,
  nomeFallback,
  size = 28,
}: {
  icone: BancoIconeId | string | null;
  corFallback?: string;
  nomeFallback?: string;
  size?: number;
}) {
  if (icone && isBancoIconeId(icone)) {
    const { cor, glifo } = BANCO_ICONES[icone];
    return <Roundel cor={cor} glifo={glifo} size={size} />;
  }
  const glifo =
    (nomeFallback ?? "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <Roundel cor={corFallback ?? "#c67139"} glifo={glifo} size={size} />
  );
}
