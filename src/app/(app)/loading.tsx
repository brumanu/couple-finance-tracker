import { Skeleton } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-8 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-72 rounded-full" />
        </div>
        <Skeleton className="h-9 w-56 rounded-full" />
      </div>

      <div className="flex flex-col gap-5 rounded-[28px] bg-card p-7 md:p-8">
        <div>
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="mt-3 h-14 w-64 rounded-lg" />
          <Skeleton className="mt-3 h-4 w-96 rounded-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[18px] bg-surface-soft px-4 py-3">
              <Skeleton className="h-2.5 w-16 rounded-full" />
              <Skeleton className="mt-2 h-6 w-24 rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>

      <div className="flex flex-col gap-4 rounded-[26px] bg-card p-5 md:p-6">
        <div>
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="mt-2 h-3 w-64 rounded-full" />
        </div>
        <div className="flex items-end gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <Skeleton className="h-3 w-10 rounded-full" />
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-3 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-[26px] bg-surface-soft p-6"
          >
            <Skeleton className="h-3 w-40 rounded-full" />
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            {Array.from({ length: 4 }).map((_, k) => (
              <div
                key={k}
                className="flex items-center justify-between"
              >
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40 rounded-full" />
            {Array.from({ length: 4 }).map((_, k) => (
              <Skeleton
                key={k}
                className="h-14 rounded-[26px]"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
