import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function RelatorioCategoriaPorMesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <Skeleton className="h-8 w-24 rounded-full" />

      <div>
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-96 rounded-full" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col p-3 md:p-4">
          <div className="flex items-center gap-3 px-2 py-2.5">
            <Skeleton className="h-3 w-20 rounded-full" />
            <div className="ml-auto flex gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-10 rounded-full" />
              ))}
              <Skeleton className="h-3 w-12 rounded-full" />
            </div>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-t border-border/60 px-2 py-3"
            >
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 w-28 rounded-full" />
              <div className="ml-auto flex gap-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-5 w-14 rounded-md" />
                ))}
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
