"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/ui/icons";
import { GradeAccordionItem } from "@/components/director/GradeAccordion";
import { formatSom } from "@/lib/format";
import {
  gradePaymentStats,
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
 * Toʻlovlar — uch bosqichli kesim:
 *   1) sinf darajasi  — "5-sinflar", "6-sinflar" …
 *   2) parallel sinf  — 5-A, 5-B
 *   3) oʻquvchilar    — shartnoma, toʻlangan, qarz
 * Parallel harfi boʻyicha filtr ("barcha A sinflar qanday") kesimlarni
 * ham qayta hisoblaydi.
 */
export function PaymentsBoard({
  summary,
  classStats,
}: {
  summary: FinanceSummary;
  classStats: ClassPaymentStat[];
}) {
  const [parallel, setParallel] = useState<string>("all");
  const [openGrade, setOpenGrade] = useState<number | null>(null);
  const [openClass, setOpenClass] = useState<string | null>(null);

  const parallels = useMemo(
    () => Array.from(new Set(classStats.map((c) => c.parallel))).sort(),
    [classStats],
  );

  const shownClasses = useMemo(
    () => (parallel === "all" ? classStats : classStats.filter((c) => c.parallel === parallel)),
    [classStats, parallel],
  );

  const grades = useMemo(() => gradePaymentStats(shownClasses), [shownClasses]);

  // Filtrlangan kesim boʻyicha jamlanma — jadval sarlavhasida.
  const filteredTotals = useMemo(
    () =>
      shownClasses.reduce(
        (acc, c) => ({
          expected: acc.expected + c.expected,
          collected: acc.collected + c.collected,
          debt: acc.debt + c.debt,
        }),
        { expected: 0, collected: 0, debt: 0 },
      ),
    [shownClasses],
  );
  const filteredPercent =
    filteredTotals.expected === 0
      ? 0
      : Math.round((filteredTotals.collected / filteredTotals.expected) * 100);

  function toggleParallel(next: string) {
    setParallel(next);
    setOpenGrade(null);
    setOpenClass(null);
  }

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
          <p className="num mt-1 text-xl font-bold text-danger">{formatSom(summary.debt)}</p>
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
            <span className="num">{formatSom(summary.collected)}</span>
          </p>
        </Card>
      </div>

      {/* Parallel filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground-muted">Parallel:</span>
        <button
          type="button"
          onClick={() => toggleParallel("all")}
          aria-pressed={parallel === "all"}
          className={chipClass(parallel === "all")}
        >
          Barchasi
        </button>
        {parallels.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => toggleParallel(p)}
            aria-pressed={parallel === p}
            className={chipClass(parallel === p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Sinf darajalari kesimi */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Sinf darajalari kesimida toʻlov
          </h2>
          <p className="text-xs text-foreground-muted">
            Yigʻilgan <span className="num font-medium text-foreground">{filteredPercent}%</span> ·{" "}
            <span className="num">{formatSom(filteredTotals.collected)}</span> / qarz{" "}
            <span className="num text-danger">{formatSom(filteredTotals.debt)}</span>
          </p>
        </div>

        {grades.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground-muted">
            Bu parallelda sinf topilmadi.
          </p>
        ) : (
          <ul>
            {grades.map((grade) => (
              <GradeAccordionItem
                key={grade.grade}
                title={`${grade.grade}-sinflar`}
                meta={`${grade.classCount} ta sinf · ${grade.studentCount} oʻquvchi`}
                percent={grade.collectedPercent}
                barClass={percentBar(grade.collectedPercent)}
                right={
                  <>
                    <span>
                      Yigʻilgan{" "}
                      <span className="num font-medium text-foreground">
                        {formatSom(grade.collected)}
                      </span>
                    </span>
                    <span>
                      Qarz{" "}
                      <span className="num font-medium text-danger">
                        {grade.debt > 0 ? formatSom(grade.debt) : "—"}
                      </span>
                    </span>
                  </>
                }
                isOpen={openGrade === grade.grade}
                onToggle={() => {
                  setOpenGrade(openGrade === grade.grade ? null : grade.grade);
                  setOpenClass(null);
                }}
              >
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                          <th className="px-3 py-2">Sinf</th>
                          <th className="px-3 py-2">Sinf rahbari</th>
                          <th className="px-3 py-2">Oʻquvchi</th>
                          <th className="px-3 py-2">Yigʻilgan</th>
                          <th className="w-[160px] px-3 py-2">Foiz</th>
                          <th className="px-3 py-2">Qarzdorlik</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {grade.classes.map((stat) => (
                          <ClassRow
                            key={stat.className}
                            stat={stat}
                            isOpen={openClass === stat.className}
                            onToggle={() =>
                              setOpenClass(
                                openClass === stat.className ? null : stat.className,
                              )
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </GradeAccordionItem>
            ))}
          </ul>
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

function percentBar(percent: number): string {
  return percent >= 90 ? "bg-success" : percent >= 75 ? "bg-warning" : "bg-danger";
}

function ClassRow({
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
        className={`border-b border-border last:border-0 ${
          isOpen ? "bg-brand-tint/30" : "hover:bg-surface-muted/50"
        }`}
      >
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="font-medium text-foreground hover:text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            {stat.className}
          </button>
        </td>
        <td className="px-3 py-2.5 text-foreground-muted">{stat.homeroomTeacherName ?? "—"}</td>
        <td className="num px-3 py-2.5 text-foreground-muted">{stat.studentCount}</td>
        <td className="num px-3 py-2.5 text-foreground">{formatSom(stat.collected)}</td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${percentBar(stat.collectedPercent)}`}
                style={{ width: `${stat.collectedPercent}%` }}
              />
            </div>
            <span className="num w-10 shrink-0 text-right text-xs font-medium text-foreground">
              {stat.collectedPercent}%
            </span>
          </div>
        </td>
        <td className="num px-3 py-2.5 text-danger">
          {stat.debt > 0 ? formatSom(stat.debt) : "—"}
        </td>
        <td className="px-3 py-2.5 text-right">
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
        <tr className="border-b border-border bg-surface-muted/40">
          <td colSpan={7} className="px-3 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {stat.className} — oʻquvchilar kesimida
            </p>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[560px] border-collapse text-sm">
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
