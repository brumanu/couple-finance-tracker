import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function RelatorioRendaXDespesaLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <Skeleton className="h-8 w-24 rounded-full" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-96 rounded-full" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-3 w-28 rounded-full" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <Skeleton className="h-2.5 w-40 rounded-full" />
            <Skeleton className="mt-2 h-3.5 w-72 rounded-full" />
          </div>
          <div className="flex items-end justify-center gap-10 px-4 pb-1 md:gap-16">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-3.5 w-16 rounded-full" />
                <Skeleton className="h-40 w-20 rounded-md" />
                <Skeleton className="h-3 w-14 rounded-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-8 w-full rounded-full" />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <Skeleton className="h-2.5 w-32 rounded-full" />
            <Skeleton className="mt-2 h-3.5 w-80 rounded-full" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Skeleton className="h-3.5 w-32 rounded-full" />
                  <Skeleton className="h-3.5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
