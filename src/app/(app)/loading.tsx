import { Skeleton } from "@/components/skeleton";

/**
 * Este loading é o boundary do LAYOUT — aparece em toda rota de (app)
 * enquanto o segmento carrega, não só no dashboard. Por isso é genérico:
 * antes ele desenhava o dashboard inteiro (hero + gráfico de 6 barras) e o
 * usuário via um esqueleto de dashboard ao abrir Relatórios ou Cartões, com
 * um salto grande de layout quando o conteúdo real chegava.
 *
 * Cada rota tem o seu próprio loading.tsx com o formato certo; este só
 * segura o cabeçalho e alguns blocos até lá.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-8 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-full max-w-72 rounded-full" />
        </div>
        <Skeleton className="h-9 w-56 rounded-full" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-[26px] bg-card px-5 py-4"
          >
            <Skeleton className="size-[38px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-full max-w-40 rounded-full" />
              <Skeleton className="mt-2 h-3 w-24 rounded-full" />
            </div>
            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
