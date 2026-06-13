import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level pending state for the whole tab shell: nested tab segments
// inherit this boundary, so every tab switch shows structure immediately
// instead of blocking silently on the server fetches. The layout's tabs stay
// interactive above it.
export default function MatchDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5" aria-busy="true">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-5 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-44" />
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-36" />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="order-2 lg:order-1">
          <CardContent className="flex flex-col gap-4 pt-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-2 w-full rounded-full" />
            {/* Five tiles to mirror SCORE_ROWS exactly — a 4-tile skeleton
                shifts everything below by one row when the real grid lands. */}
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
            <Skeleton className="h-24 rounded-lg" />
          </CardContent>
        </Card>
        <Card className="order-1 lg:order-2 self-start">
          <CardContent className="flex flex-col gap-3 pt-6">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-9 rounded-lg" />
            <Skeleton className="h-9 rounded-lg" />
            <Skeleton className="h-9 rounded-lg" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
