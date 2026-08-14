import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function RelatorioFluxoMensalLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <Skeleton className="h-8 w-24 rounded-full" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-10 w-56 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-96 rounded-full" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <Skeleton className="h-2.5 w-40 rounded-full" />
            <Skeleton className="mt-2 h-3 w-72 rounded-full" />
          </div>
          <div className="flex items-end gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex min-w-[48px] flex-1 flex-col items-center gap-1.5"
              >
                <Skeleton className="h-3 w-8 rounded-full" />
                <Skeleton
                  className="w-full rounded-md"
                  style={{ height: `${40 + ((i * 7) % 60)}px` }}
                />
                <Skeleton className="h-2.5 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col divide-y divide-border/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-4">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
