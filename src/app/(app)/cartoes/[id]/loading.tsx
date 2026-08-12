import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function CartaoDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <Skeleton className="h-8 w-24 rounded-full" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div>
            <Skeleton className="h-9 w-48 rounded-lg" />
            <Skeleton className="mt-2 h-4 w-64 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-56 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-12 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-full" />
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-3 w-28 rounded-full" />
        </div>
        <Card>
          <div className="flex flex-col divide-y divide-border/60">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-3 p-5"
              >
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-48 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-40 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, k) => (
                    <div key={k}>
                      <Skeleton className="h-2.5 w-14 rounded-full" />
                      <Skeleton className="mt-2 h-3.5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
                <Skeleton className="size-7 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-3 w-24 rounded-full" />
        </div>
        <Card>
          <div className="flex flex-col divide-y divide-border/60">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-5">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-44 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-32 rounded-full" />
                </div>
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
