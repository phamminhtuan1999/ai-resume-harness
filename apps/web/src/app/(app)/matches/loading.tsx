import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Pending state for the Analyzed Jobs list: the table's shape appears
// immediately while the rows resolve.
export default function MatchesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5" aria-busy="true">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, row) => (
            <div key={row} className="flex items-center gap-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="h-5 w-12 rounded-lg" />
              <Skeleton className="h-5 w-28 rounded-lg" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
