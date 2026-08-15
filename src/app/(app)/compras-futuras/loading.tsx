import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function ComprasFuturasLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-10 w-56 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-80 rounded-full" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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

      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40 rounded-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-[26px] bg-card px-5 py-4"
            >
              <Skeleton className="size-[38px] shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40 rounded-full" />
                <Skeleton className="mt-2 h-3 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
