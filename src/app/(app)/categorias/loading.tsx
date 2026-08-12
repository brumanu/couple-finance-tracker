import { Skeleton } from "@/components/skeleton";

export default function CategoriasLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-80 rounded-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      <div className="rounded-[26px] bg-card px-6">
        <div className="flex flex-col divide-y divide-border/60">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-36 rounded-full" />
                <Skeleton className="mt-2 h-3 w-28 rounded-full" />
              </div>
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="size-7 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
