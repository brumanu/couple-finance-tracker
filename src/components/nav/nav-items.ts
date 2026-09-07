import {
  HomeIcon,
  WalletIcon,
  FileTextIcon,
  ShoppingCartIcon,
  ShoppingBagIcon,
  ShoppingBasketIcon,
  CreditCardIcon,
  HandCoinsIcon,
  TagIcon,
  BarChart3Icon,
  CalculatorIcon,
  ReceiptTextIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** Se true, aparece só no sidebar (desktop) — não no bottom-nav mobile */
  desktopOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: HomeIcon },
  { href: "/recorrentes", label: "Contas", icon: FileTextIcon },
  { href: "/cartoes", label: "Cartões", icon: CreditCardIcon },
  { href: "/despesas", label: "Despesas", icon: ShoppingCartIcon },
  // A lista de mercado é a tela mais mobile do app: usada em pé, no corredor,
  // com uma mão só. Deixá-la a dois toques no menu lateral contrariaria o
  // motivo dela existir, então ela ocupa um dos 6 slots fixos do bottom-nav.
  // Quem saiu foi Rendas, que se cadastra uma vez e se revisa quando muda de
  // salário — ela continua no menu lateral, que abre no mobile também.
  { href: "/mercado", label: "Mercado", icon: ShoppingBasketIcon },
  { href: "/dividas", label: "Dívidas", icon: HandCoinsIcon },
  {
    href: "/compras-futuras",
    label: "Quero comprar",
    icon: ShoppingBagIcon,
    // O bottom-nav mobile é um grid de 6 colunas fixas — item novo entra
    // pelo menu lateral, que agora abre no mobile também.
    desktopOnly: true,
  },
  {
    href: "/faturamento-mei",
    label: "Faturamento MEI",
    icon: ReceiptTextIcon,
    desktopOnly: true,
  },
  {
    href: "/salario-liquido",
    label: "Salário líquido",
    icon: CalculatorIcon,
    desktopOnly: true,
  },
  { href: "/rendas", label: "Rendas", icon: WalletIcon, desktopOnly: true },
  { href: "/categorias", label: "Categorias", icon: TagIcon, desktopOnly: true },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3Icon, desktopOnly: true },
];
