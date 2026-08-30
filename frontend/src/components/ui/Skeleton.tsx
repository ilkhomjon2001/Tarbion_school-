/**
 * Yuklanish holatlari. Skeleton kelayotgan kontentning SHAKLINI takrorlaydi —
 * boʻsh kulrang quti emas. Shunda maʼlumot kelganda sahifa sakramaydi va
 * foydalanuvchi nima kutayotganini oldindan koʻradi.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <Skeleton className="mb-2 h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Koʻrsatkich kartochkasi: sarlavha + belgi, katta raqam, izoh. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

/** Grafik kartochkasi: sarlavha, katta raqam, chizma maydoni, oʻq belgilari. */
export function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 shadow-sm ${className}`}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <Skeleton className="mt-4 h-8 w-24" />
      <div className="mt-3 flex gap-2">
        <div className="flex w-11 shrink-0 flex-col justify-between py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-8" />
          ))}
        </div>
        <Skeleton className="h-40 flex-1" />
      </div>
    </div>
  );
}

/** Jadval: sarlavha qatori + koʻrsatilgan sondagi qator. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex gap-4 border-b border-border bg-surface-muted/60 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 flex-1 ${c === 0 ? "max-w-20" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
