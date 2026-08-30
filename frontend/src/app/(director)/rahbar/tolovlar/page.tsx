import { Suspense } from "react";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { PaymentsBoard } from "@/components/director/PaymentsBoard";
import { getClassPaymentStats, getFinanceSummary } from "@/lib/director/fetchers";

export default function PaymentsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Toʻlovlar holati</h1>
        <p className="text-sm text-foreground-muted">
          5-sinflar → 5-A → oʻquvchilar: har bosqichda yigʻilish foizi va summasi
        </p>
      </div>
      <Suspense fallback={<PaymentsSkeleton />}>
        <PaymentsSection />
      </Suspense>
    </div>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton rows={7} columns={4} />
    </div>
  );
}

async function PaymentsSection() {
  const [summary, classStats] = await Promise.all([
    getFinanceSummary(1),
    getClassPaymentStats(),
  ]);
  return <PaymentsBoard summary={summary} classStats={classStats} />;
}
