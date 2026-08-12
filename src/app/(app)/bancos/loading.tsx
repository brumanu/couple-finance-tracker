import { Skeleton } from "@/components/skeleton";

export default function BancosLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-72 rounded-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[24px] bg-card p-4"
          >
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="mt-2 h-3 w-24 rounded-full" />
            </div>
            <Skeleton className="size-8 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
