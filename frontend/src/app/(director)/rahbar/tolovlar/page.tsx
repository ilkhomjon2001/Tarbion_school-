import { Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate, formatSom } from "@/lib/format";
import { getPayments } from "@/lib/director/fetchers";
import type { PaymentRecord, PaymentStatus } from "@/lib/director/types";

const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Toʻlangan",
  overdue: "Kechikmoqda",
  partial: "Qisman toʻlangan",
};

const STATUS_TONE: Record<PaymentStatus, "success" | "danger" | "warning"> = {
  paid: "success",
  overdue: "danger",
  partial: "warning",
};

export default function PaymentsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Toʻlovlar holati</h1>
        <p className="text-sm text-foreground-muted">Oʻquvchilar boʻyicha toʻlov monitoringi</p>
      </div>
      <Suspense fallback={<Card className="h-96 animate-pulse" />}>
        <PaymentsSection />
      </Suspense>
    </div>
  );
}

async function PaymentsSection() {
  const records = await getPayments();
  const total = records.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const overdueCount = records.filter((r) => r.status === "overdue").length;
  const paidCount = records.filter((r) => r.status === "paid").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-foreground-muted">Bu oy tushum</p>
          <p className="mt-1 text-xl font-bold text-foreground num">{formatSom(total)}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">Kechikkan toʻlovlar</p>
          <p className="mt-1 text-xl font-bold text-danger">{overdueCount} ta</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">Bu oy toʻlangan</p>
          <p className="mt-1 text-xl font-bold text-success">{paidCount} ta</p>
        </Card>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-4 py-3">Oʻquvchi</th>
                <th className="px-4 py-3">Sinf</th>
                <th className="px-4 py-3">Summa</th>
                <th className="px-4 py-3">Muddat</th>
                <th className="px-4 py-3">Holati</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: PaymentRecord) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{r.studentFullName}</td>
                  <td className="px-4 py-3 text-foreground-muted">{r.className}</td>
                  <td className="px-4 py-3 text-foreground-muted">{formatSom(r.amount)}</td>
                  <td className="px-4 py-3 text-foreground-muted">{formatDate(r.dueDate)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
