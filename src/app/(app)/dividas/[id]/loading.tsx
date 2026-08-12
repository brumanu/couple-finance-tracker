import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function DividaDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
      <Skeleton className="h-8 w-24 rounded-full" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-72 rounded-full" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>

      <Card>
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-12 w-48 rounded-lg" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36 rounded-full" />
        <Card>
          <div className="flex flex-col divide-y divide-border/60">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-24 rounded-full" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
