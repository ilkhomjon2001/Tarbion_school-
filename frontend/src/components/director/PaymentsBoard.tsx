"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import {
  PAYMENT_STATUS_LABELS,
  studentsOfClass,
  type ClassPaymentStat,
  type FinanceSummary,
  type PaymentStatus,
} from "@/lib/director/school-data";

const STATUS_TONE: Record<PaymentStatus, "success" | "warning" | "danger"> = {
  paid: "success",
  partial: "warning",
  overdue: "danger",
};

/**
 * Toʻlovlar — avval SINFLAR kesimi (foiz + summa), sinf tanlangach
 * oʻquvchilar kesimi. Parallel harfi boʻyicha filtr (A, B, V, G) —
 * "barcha 8-sinflar qanday" degan savolga tez javob berish uchun.
 */
export function PaymentsBoard({
  summary,
  classStats,
}: {
  summary: FinanceSummary;
  classStats: ClassPaymentStat[];
}) {
  const [parallel, setParallel] = useState<string>("all");
  const [openClass, setOpenClass] = useState<string | null>(null);

  const parallels = useMemo(
    () => Array.from(new Set(classStats.map((c) => c.parallel))).sort(),
    [classStats],
  );

  const shown = useMemo(
    () => (parallel === "all" ? classStats : classStats.filter((c) => c.parallel === parallel)),
    [classStats, parallel],
  );

  // Filtrlangan kesim boʻyicha jamlanma — pastdagi jadval sarlavhasida.
  const filteredTotals = useMemo(
    () =>
      shown.reduce(
        (acc, c) => ({
          expected: acc.expected + c.expected,
          collected: acc.collected + c.collected,
          debt: acc.debt + c.debt,
        }),
        { expected: 0, collected: 0, debt: 0 },
      ),
    [shown],
  );
  const filteredPercent =
    filteredTotals.expected === 0
      ? 0
      : Math.round((filteredTotals.collected / filteredTotals.expected) * 100);

  return (
    <div className="flex flex-col gap-5">
      {/* Jamlanma kartochkalar — summa kartochka ichida */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-foreground-muted">Bu oy tushum</p>
          <p className="num mt-1 text-xl font-bold text-foreground">
            {formatSom(summary.collected)}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Rejadan <span className="num">{formatSom(summary.expected)}</span> ·{" "}
            <span className="num font-medium text-success">{summary.collectedPercent}%</span>
          </p>
        </Card>

        <Card>
          <p className="text-sm text-foreground-muted">Kechikkan toʻlovlar</p>
          <p className="num mt-1 text-xl font-bold text-danger">
            {formatSom(summary.debt)}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            <span className="num">{summary.overdueCount}</span> ta toʻlanmagan,{" "}
            <span className="num">{summary.partialCount}</span> ta qisman ·{" "}
            <span className="num font-medium text-danger">{summary.debtPercent}%</span>
          </p>
        </Card>

        <Card>
          <p className="text-sm text-foreground-muted">Bu oy toʻlangan</p>
          <p className="num mt-1 text-xl font-bold text-success">
            {summary.paidCount} ta oʻquvchi
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            Toʻliq toʻlagan ·{" "}
            <span className="num">
              {formatSom(summary.collected - (summary.collected % 1))}
            </span>
          </p>
        </Card>
      </div>

      {/* Parallel filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground-muted">Parallel:</span>
        <button
          type="button"
          onClick={() => setParallel("all")}
          aria-pressed={parallel === "all"}
          className={chipClass(parallel === "all")}
        >
          Barchasi
        </button>
        {parallels.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setParallel(p)}
            aria-pressed={parallel === p}
            className={chipClass(parallel === p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Sinflar kesimi */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Sinflar kesimida toʻlov</h2>
          <p className="text-xs text-foreground-muted">
            Yigʻilgan <span className="num font-medium text-foreground">{filteredPercent}%</span> ·{" "}
            <span className="num">{formatSom(filteredTotals.collected)}</span> / qarz{" "}
            <span className="num text-danger">{formatSom(filteredTotals.debt)}</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-4 py-3">Sinf</th>
                <th className="px-4 py-3">Sinf rahbari</th>
                <th className="px-4 py-3">Oʻquvchi</th>
                <th className="px-4 py-3">Yigʻilgan</th>
                <th className="px-4 py-3 w-[180px]">Foiz</th>
                <th className="px-4 py-3">Qarzdorlik</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((stat) => {
                const isOpen = openClass === stat.className;
                return (
                  <FragmentRow
                    key={stat.className}
                    stat={stat}
                    isOpen={isOpen}
                    onToggle={() => setOpenClass(isOpen ? null : stat.className)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {shown.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-foreground-muted">
            Bu parallelda sinf topilmadi.
          </p>
        )}
      </div>
    </div>
  );
}

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    active
      ? "bg-brand text-brand-foreground"
      : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
  }`;
}

function FragmentRow({
  stat,
  isOpen,
  onToggle,
}: {
  stat: ClassPaymentStat;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const students = isOpen ? studentsOfClass(stat.className) : [];

  return (
    <>
      <tr
        className={`border-b border-border last:border-0 ${isOpen ? "bg-brand-tint/30" : "hover:bg-surface-muted/50"}`}
      >
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="font-medium text-foreground hover:text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            {stat.className}
          </button>
        </td>
        <td className="px-4 py-3 text-foreground-muted">{stat.homeroomTeacherName ?? "—"}</td>
        <td className="num px-4 py-3 text-foreground-muted">{stat.studentCount}</td>
        <td className="num px-4 py-3 text-foreground">{formatSom(stat.collected)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${
                  stat.collectedPercent >= 90
                    ? "bg-success"
                    : stat.collectedPercent >= 75
                      ? "bg-warning"
                      : "bg-danger"
                }`}
                style={{ width: `${stat.collectedPercent}%` }}
              />
            </div>
            <span className="num w-10 shrink-0 text-right text-xs font-medium text-foreground">
              {stat.collectedPercent}%
            </span>
          </div>
        </td>
        <td className="num px-4 py-3 text-danger">
          {stat.debt > 0 ? formatSom(stat.debt) : "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={onToggle}
            aria-label={`${stat.className} oʻquvchilarini ${isOpen ? "yopish" : "koʻrish"}`}
            className="text-foreground-muted transition-colors hover:text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <ChevronRightIcon
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </button>
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-border bg-surface-muted/30">
          <td colSpan={7} className="px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {stat.className} — oʻquvchilar kesimida
            </p>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-2">Oʻquvchi</th>
                    <th className="px-3 py-2">Shartnoma</th>
                    <th className="px-3 py-2">Toʻlangan</th>
                    <th className="px-3 py-2">Qarz</th>
                    <th className="px-3 py-2">Muddat</th>
                    <th className="px-3 py-2">Holati</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const debt = student.monthlyFee - student.paidAmount;
                    return (
                      <tr key={student.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {student.fullName}
                        </td>
                        <td className="num px-3 py-2 text-foreground-muted">
                          {formatSom(student.monthlyFee)}
                        </td>
                        <td className="num px-3 py-2 text-foreground-muted">
                          {formatSom(student.paidAmount)}
                        </td>
                        <td className="num px-3 py-2 text-danger">
                          {debt > 0 ? formatSom(debt) : "—"}
                        </td>
                        <td className="px-3 py-2 text-foreground-muted">{student.dueDate}</td>
                        <td className="px-3 py-2">
                          <Badge tone={STATUS_TONE[student.status]}>
                            {PAYMENT_STATUS_LABELS[student.status]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
