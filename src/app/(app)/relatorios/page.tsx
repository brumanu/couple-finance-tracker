import Link from "next/link";
import { CreditCardIcon, ChevronRightIcon, RepeatIcon } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";

type Relatorio = {
  href: string;
  titulo: string;
  descricao: string;
  Icon: typeof CreditCardIcon;
};

const RELATORIOS: Relatorio[] = [
  {
    href: "/relatorios/compras-parceladas",
    titulo: "Compras parceladas",
    descricao:
      "Todas as compras parceladas de todos os cartões — quanto falta pagar, em quantas parcelas.",
    Icon: CreditCardIcon,
  },
  {
    href: "/relatorios/assinaturas",
    titulo: "Assinaturas dos cartões",
    descricao:
      "Todas as assinaturas recorrentes de todos os cartões — quantas são e quanto pesam no mês.",
    Icon: RepeatIcon,
  },
];

export default async function RelatoriosPage() {
  await requireSession();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <header>
        <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
          Relatórios
        </h2>
        <p className="mt-1.5 max-w-[60ch] text-[15px] text-neutral-700">
          Visões consolidadas dos seus dados. Vamos adicionando aos poucos.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {RELATORIOS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group rounded-[26px] transition-shadow hover:shadow-organic-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="flex items-start gap-4 rounded-[26px] bg-card px-6 py-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-800">
                <r.Icon className="size-5" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-heading text-[19px] leading-tight">
                    {r.titulo}
                  </p>
                  <ChevronRightIcon
                    className="ml-auto size-4 text-neutral-700 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2.5}
                  />
                </div>
                <p className="mt-1 text-[13px] text-neutral-700">
                  {r.descricao}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
