import { Skeleton } from "@/components/skeleton";

export default function DividasLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-80 rounded-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      <div className="flex flex-wrap items-baseline gap-8 rounded-[28px] bg-accent-100 px-7 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="mt-2 h-8 w-32 rounded-lg" />
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28 rounded-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-4 rounded-[26px] bg-card px-6 py-5"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Skeleton className="h-5 w-40 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-56 rounded-full" />
                </div>
                <Skeleton className="size-7 rounded-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-lg" />
                </div>
              </div>
              <Skeleton className="h-8 w-full rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
