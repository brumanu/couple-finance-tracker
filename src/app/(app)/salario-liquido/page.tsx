import { requireSession } from "@/lib/auth";
import { CalculadoraSalario } from "./calculadora";

export default async function SalarioLiquidoPage() {
  await requireSession();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <header>
        <h2 className="font-heading text-3xl leading-tight md:text-[34px]">
          Salário líquido
        </h2>
        <p className="mt-1.5 max-w-[56ch] text-[15px] text-neutral-700">
          Quanto cai na conta depois de INSS e imposto de renda — com a conta
          aberta, faixa por faixa.
        </p>
      </header>

      <CalculadoraSalario />
    </div>
  );
}
