"use client";

import { useEffect, useState } from "react";

import { StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { formatSom } from "@/lib/format";
import {
  fetchFinanceStudents,
  fetchFinanceSummary,
  type FinanceSummaryOut,
  type StudentFinanceOut,
} from "@/lib/payments/api";

/**
 * Toʻlovlar (DIR-05) — BAZADAN, faqat oʻqish.
 *
 * Direktor maʼlumot kiritmaydi: jamlanma va qarzdorlar roʻyxatini
 * koʻradi. Kiritish administrator kabinetida (`payments.manage`).
 */
export default function DirectorPaymentsPage() {
  const [summary, setSummary] = useState<FinanceSummaryOut | null>(null);
  const [debtors, setDebtors] = useState<StudentFinanceOut[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchFinanceSummary(), fetchFinanceStudents(true)])
      .then(([s, d]) => {
        if (!alive) return;
        setSummary(s);
        setDebtors(d);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Toʻlovlar</h1>
        <p className="text-sm text-foreground-muted">
          Jamlanma va qarzdorlar — kiritish administrator kabinetida
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Maʼlumotni olib boʻlmadi.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary === null ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          [
            ["Hisoblangan", formatSom(summary.charged)],
            ["Tushum", formatSom(summary.paid)],
            ["Qarz", formatSom(summary.debt)],
            ["Qarzdorlar", String(summary.debtors)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                {label}
              </p>
              <p className="num mt-1 text-xl font-bold text-foreground">{value}</p>
            </div>
          ))
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Qarzdorlar</h2>
        {debtors === null ? (
          <TableSkeleton rows={5} />
        ) : debtors.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
            Qarzdor yoʻq — barcha hisoblar yopilgan.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="scroll-x">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-3">Oʻquvchi</th>
                    <th className="px-3 py-3">Sinf</th>
                    <th className="px-3 py-3 text-right">Hisoblangan</th>
                    <th className="px-3 py-3 text-right">Toʻlangan</th>
                    <th className="px-3 py-3 text-right">Qarz</th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.map((r) => (
                    <tr
                      key={r.student_id}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {r.student_name}
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">{r.class_name ?? "—"}</td>
                      <td className="num px-3 py-2.5 text-right text-foreground-muted">
                        {formatSom(r.charged)}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-foreground-muted">
                        {formatSom(r.paid)}
                      </td>
                      <td className="num px-3 py-2.5 text-right font-semibold text-danger">
                        {formatSom(-r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
