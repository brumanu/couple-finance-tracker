import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-6 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {[15, 30].map((q) => (
          <Card key={q}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="mt-1 h-4 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
              <Skeleton className="h-3 w-16" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
