import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-3.5 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
