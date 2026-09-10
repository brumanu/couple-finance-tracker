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
  LandmarkIcon,
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
  /** Se true, também ocupa um dos slots fixos do bottom-nav mobile. */
  barraInferior?: boolean;
};

export type NavGroup = {
  /** Sem título, o grupo aparece solto no topo do menu (só o Início). */
  titulo?: string;
  itens: NavItem[];
};

// O app começou só com as finanças do mês e foi ganhando ferramentas que não
// são controle de gasto (MEI, CLT, mercado). Os grupos separam por assunto
// pra que cada função nova tenha onde cair sem virar mais um item solto no
// meio das contas — "Casa" existe pras próximas coisas do casal que não são
// dinheiro, mesmo tendo só o Mercado por enquanto.
export const NAV_GROUPS: NavGroup[] = [
  {
    itens: [{ href: "/", label: "Início", icon: HomeIcon, barraInferior: true }],
  },
  {
    titulo: "Mês",
    itens: [
      {
        href: "/recorrentes",
        label: "Contas",
        icon: FileTextIcon,
        barraInferior: true,
      },
      {
        href: "/cartoes",
        label: "Cartões",
        icon: CreditCardIcon,
        barraInferior: true,
      },
      // Fora do bottom-nav: no celular despesa se lança pelo FAB, que já
      // aparece em todas as telas.
      { href: "/despesas", label: "Despesas", icon: ShoppingCartIcon },
      { href: "/rendas", label: "Rendas", icon: WalletIcon },
    ],
  },
  {
    titulo: "Planos",
    itens: [
      { href: "/dividas", label: "Dívidas", icon: HandCoinsIcon },
      { href: "/compras-futuras", label: "Quero comprar", icon: ShoppingBagIcon },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3Icon },
    ],
  },
  {
    titulo: "Casa",
    itens: [
      // A lista de mercado é a tela mais mobile do app: usada em pé, no
      // corredor, com uma mão só — por isso fica no bottom-nav.
      {
        href: "/mercado",
        label: "Mercado",
        icon: ShoppingBasketIcon,
        barraInferior: true,
      },
    ],
  },
  {
    titulo: "Trabalho",
    itens: [
      { href: "/faturamento-mei", label: "Faturamento MEI", icon: ReceiptTextIcon },
      { href: "/salario-liquido", label: "Salário líquido", icon: CalculatorIcon },
    ],
  },
  {
    titulo: "Ajustes",
    itens: [
      { href: "/categorias", label: "Categorias", icon: TagIcon },
      { href: "/bancos", label: "Bancos", icon: LandmarkIcon },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.itens);

export function isNavItemAtivo(item: NavItem, pathname: string): boolean {
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}
