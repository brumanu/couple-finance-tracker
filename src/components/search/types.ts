export type SearchResultItem = {
  categoria:
    | "despesa"
    | "renda_extra"
    | "renda_fixa"
    | "conta_recorrente"
    | "compra_cartao"
    | "assinatura_cartao";
  id: string;
  titulo: string;
  subtitulo: string;
  valor: number;
  href: string;
};
