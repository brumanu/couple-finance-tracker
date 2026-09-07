import { Skeleton } from "@/components/skeleton";

export default function MercadoLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-80 rounded-full" />
        </div>
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-48 rounded-full" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>

      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-card px-4 py-3.5">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1 rounded-full" />
            <Skeleton className="size-6 shrink-0 rounded-full" />
          </div>
        ))}
      </div>

      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}
