import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function RelatorioMaioresGastosLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <Skeleton className="h-8 w-24 rounded-full" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-10 w-72 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-96 rounded-full" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 p-4 md:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <Skeleton className="h-2.5 w-16 rounded-full" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
          <Skeleton className="h-3 w-48 rounded-full" />
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
        <div className="flex flex-col divide-y divide-border/60">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="mt-2 h-3 w-56 rounded-full" />
                <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
