import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { PaymentsBoard } from "@/components/director/PaymentsBoard";
import { getClassPaymentStats, getFinanceSummary } from "@/lib/director/fetchers";

export default function PaymentsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Toʻlovlar holati</h1>
        <p className="text-sm text-foreground-muted">
          Sinflar kesimida yigʻilish foizi va summasi — sinfni bosib oʻquvchilarni koʻring
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
          <Card key={i} className="h-28 animate-pulse" />
        ))}
      </div>
      <Card className="h-96 animate-pulse" />
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
