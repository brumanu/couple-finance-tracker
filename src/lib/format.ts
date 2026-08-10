const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number | string | null | undefined): string {
  if (value == null) return "R$ 0,00";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "R$ 0,00";
  return brlFormatter.format(n);
}

// Converte input do usuário ("1.234,56" ou "1234.56" ou "1234,56") em número
export function parseBRLInput(input: string): number | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  // Se tem vírgula, assume formato pt-BR (ponto = milhar, vírgula = decimal)
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
