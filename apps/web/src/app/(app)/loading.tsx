import { Skeleton } from "@/components/ui/skeleton";

// Rendered inside the persistent app shell (from the (app) layout) while a
// protected page's data resolves. Shaped like the common page layout: a header,
// a row of summary cards, and a list panel.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card p-5 shadow-sm shadow-black/[0.02]"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-4 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-5 shadow-sm shadow-black/[0.02]">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3.5 w-64 max-w-full" />
        <div className="mt-5 grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
