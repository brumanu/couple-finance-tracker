import { Skeleton } from "@/components/skeleton";

export default function RelatoriosLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:gap-7 md:p-8">
      <div>
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="mt-2 h-4 w-72 rounded-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-[26px] bg-card px-6 py-5"
          >
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="mt-2 h-3 w-full rounded-full" />
              <Skeleton className="mt-1 h-3 w-3/4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
