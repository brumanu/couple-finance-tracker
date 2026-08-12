import {
  HomeIcon,
  WalletIcon,
  FileTextIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  HandCoinsIcon,
  TagIcon,
  BarChart3Icon,
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
  { href: "/rendas", label: "Rendas", icon: WalletIcon },
  { href: "/recorrentes", label: "Contas", icon: FileTextIcon },
  { href: "/cartoes", label: "Cartões", icon: CreditCardIcon },
  { href: "/despesas", label: "Despesas", icon: ShoppingCartIcon },
  { href: "/dividas", label: "Dívidas", icon: HandCoinsIcon },
  { href: "/categorias", label: "Categorias", icon: TagIcon, desktopOnly: true },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3Icon, desktopOnly: true },
];
