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

// Converte input do usuário ("1.234,56", "1234.56", "1234,56", "1.500") em número.
// Rejeita notação científica, hexadecimal, negativos e mais de 2 casas decimais.
export function parseBRLInput(input: string): number | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!cleaned) return null;

  let normalized: string;
  if (cleaned.includes(",")) {
    // Formato pt-BR: ponto = milhar, vírgula = decimal.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Só pontos em grupos de 3 dígitos ("1.500", "12.345.678") = separador de milhar.
    normalized = cleaned.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }

  // Só aceita dígitos com até 2 casas decimais (barra "1e3", "0x10", "-5", "1.2345").
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
