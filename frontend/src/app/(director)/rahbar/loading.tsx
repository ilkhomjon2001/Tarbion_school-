import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

/**
 * Rahbariyat boʻlimidagi sahifalar orasida oʻtishda darhol koʻrinadi.
 * Busiz maʼlumot kelguncha ekran qotib turadi va bosish ishlamayotgandek
 * tuyuladi.
 */
export default function DirectorLoading() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
