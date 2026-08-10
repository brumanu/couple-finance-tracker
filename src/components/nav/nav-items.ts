import {
  HomeIcon,
  WalletIcon,
  FileTextIcon,
  ShoppingCartIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/rendas", label: "Rendas", icon: WalletIcon },
  { href: "/recorrentes", label: "Contas", icon: FileTextIcon },
  { href: "/despesas", label: "Despesas", icon: ShoppingCartIcon },
];
