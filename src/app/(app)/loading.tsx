import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-72 rounded-full" />
        </div>
        <Skeleton className="h-9 w-56 rounded-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="flex flex-col gap-4 p-6">
            <Skeleton className="h-3 w-32 rounded-full" />
            <Skeleton className="h-14 w-56 rounded-lg" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-3 w-40 rounded-full" />
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        {[0, 1].map((i) => (
          <Card key={i}>
            <div className="flex flex-col gap-3 p-6">
              <Skeleton className="h-5 w-40 rounded-lg" />
              {Array.from({ length: 4 }).map((_, k) => (
                <Skeleton key={k} className="h-10 rounded-2xl" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
