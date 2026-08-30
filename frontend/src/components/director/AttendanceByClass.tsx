"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import {
  allClassAttendanceStats,
  attendanceOf,
  ATTENDANCE_PERIOD_LABELS,
  isAtRisk,
  studentsOfClass,
  type AttendancePeriod,
  type ClassAttendanceStat,
} from "@/lib/director/school-data";

const PERIODS: AttendancePeriod[] = ["week", "month"];

/**
 * Davomat — sinflar kesimida (eng pastdan boshlab), sinf tanlangach
 * oʻquvchilar kesimida. Haftalik/oylik almashtirgich bilan.
 */
export function AttendanceByClass() {
  const [period, setPeriod] = useState<AttendancePeriod>("month");
  const [parallel, setParallel] = useState<string>("all");
  const [openClass, setOpenClass] = useState<string | null>(null);

  const stats = useMemo(() => allClassAttendanceStats(period), [period]);
  const parallels = useMemo(
    () => Array.from(new Set(stats.map((s) => s.parallel))).sort(),
    [stats],
  );
  const shown = useMemo(
    () => (parallel === "all" ? stats : stats.filter((s) => s.parallel === parallel)),
    [stats, parallel],
  );

  const schoolAverage =
    shown.length === 0
      ? 0
      : Math.round(shown.reduce((sum, s) => sum + s.averagePercent, 0) / shown.length);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Sinflar kesimida davomat
          </h2>
          <p className="text-xs text-foreground-muted">
            Eng past koʻrsatkich tepada · oʻrtacha{" "}
            <span className="num font-medium text-foreground">{schoolAverage}%</span>
          </p>
        </div>

        <div role="group" aria-label="Davr" className="flex gap-1 rounded-lg border border-border p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                period === p
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {ATTENDANCE_PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              <th className="px-4 py-3">Sinf</th>
              <th className="px-4 py-3">Sinf rahbari</th>
              <th className="px-4 py-3">Oʻquvchi</th>
              <th className="w-[200px] px-4 py-3">Davomat</th>
              <th className="px-4 py-3">Xavf ostida</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((stat) => (
              <ClassRow
                key={stat.className}
                stat={stat}
                period={period}
                isOpen={openClass === stat.className}
                onToggle={() =>
                  setOpenClass(openClass === stat.className ? null : stat.className)
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-foreground-muted">
          Bu parallelda sinf topilmadi.
        </p>
      )}
    </div>
  );
}

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    active
      ? "bg-brand text-brand-foreground"
      : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
  }`;
}

function barColor(percent: number): string {
  return percent >= 90 ? "bg-success" : percent >= 85 ? "bg-warning" : "bg-danger";
}

function ClassRow({
  stat,
  period,
  isOpen,
  onToggle,
}: {
  stat: ClassAttendanceStat;
  period: AttendancePeriod;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const students = isOpen
    ? [...studentsOfClass(stat.className)].sort(
        (a, b) => attendanceOf(a, period) - attendanceOf(b, period),
      )
    : [];

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
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${barColor(stat.averagePercent)}`}
                style={{ width: `${stat.averagePercent}%` }}
              />
            </div>
            <span className="num w-10 shrink-0 text-right text-xs font-medium text-foreground">
              {stat.averagePercent}%
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          {stat.atRiskCount > 0 ? (
            <Badge tone="danger">{stat.atRiskCount} ta</Badge>
          ) : (
            <span className="text-xs text-foreground-muted">—</span>
          )}
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
          <td colSpan={6} className="px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {stat.className} — oʻquvchilar kesimida (
              {ATTENDANCE_PERIOD_LABELS[period].toLowerCase()})
            </p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {students.map((student) => {
                const percent = attendanceOf(student, period);
                return (
                  <li
                    key={student.id}
                    className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {student.fullName}
                    </span>
                    <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full ${barColor(percent)}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span
                      className={`num w-10 shrink-0 text-right text-xs font-medium ${
                        isAtRisk(percent) ? "text-danger" : "text-foreground"
                      }`}
                    >
                      {percent}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
