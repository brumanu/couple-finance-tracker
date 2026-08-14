import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function RelatorioComprometimentoFuturoLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <Skeleton className="h-8 w-24 rounded-full" />

      <div>
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-96 rounded-full" />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-3 w-28 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div>
            <Skeleton className="h-3 w-40 rounded-full" />
            <Skeleton className="mt-2 h-3 w-full rounded-full" />
          </div>
          <div className="flex items-end gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <Skeleton className="h-3 w-10 rounded-full" />
                <Skeleton className="h-32 w-full rounded-md" />
                <Skeleton className="h-3 w-8 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col divide-y divide-border/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="ml-auto h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
