import Link from "next/link";
import { CreditCardIcon, ChevronRightIcon } from "lucide-react";
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
];

export default async function RelatoriosPage() {
  await requireSession();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
      <header>
        <h2 className="font-heading text-3xl leading-tight md:text-4xl">
          Relatórios
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Visões consolidadas dos seus dados. Vamos adicionando aos poucos.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {RELATORIOS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group focus:outline-none"
          >
            <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary/30">
              <div className="flex items-start gap-4 p-6">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <r.Icon className="size-5" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-heading text-lg leading-tight">
                      {r.titulo}
                    </p>
                    <ChevronRightIcon
                      className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      strokeWidth={2.5}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.descricao}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
