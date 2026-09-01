"use client";

/**
 * Sinflar — BAZADAN (DIR-03).
 *
 * Roʻyxat `directorClasses` dan, tanlangan sinfning oʻquvchilar kesimi
 * `attendance/classes/{id}/students` dan keladi. Davomat davri (hafta /
 * oy) sana oraligʻi sifatida serverga yuboriladi — foiz serverda
 * hisoblanadi, frontendda emas.
 */

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { messageOf } from "@/components/shared/LiveSession";
import {
  fetchClasses,
  fetchClassStudentStats,
  isAtRisk,
  type ClassRowOut,
  type StudentStatOut,
} from "@/lib/director/api";

type Period = "week" | "month";

function rangeOf(period: Period): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - (period === "week" ? 7 : 30));
  return { from: iso(from), to: iso(today) };
}

export function LiveClassesBoard() {
  const [classes, setClasses] = useState<ClassRowOut[] | null>(null);
  const [selected, setSelected] = useState<ClassRowOut | null>(null);
  const [students, setStudents] = useState<StudentStatOut[] | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setClasses(await fetchClasses());
      } catch (err) {
        setError(messageOf(err));
      }
    })();
  }, []);

  const loadStudents = useCallback(async (cls: ClassRowOut, days: Period) => {
    setStudents(null);
    try {
      setStudents(await fetchClassStudentStats(cls.id, rangeOf(days)));
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  function open(cls: ClassRowOut) {
    if (selected?.id === cls.id) {
      setSelected(null);
      return;
    }
    setSelected(cls);
    void loadStudents(cls, period);
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (classes === null) return <TableSkeleton rows={7} columns={5} />;
  if (classes.length === 0) {
    return <EmptyState title="Sinf ochilmagan" description="Sinflar administrator kabinetida ochiladi." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-4 py-3">Sinf</th>
                <th className="px-4 py-3">Sinf rahbari</th>
                <th className="px-4 py-3 text-right">Oʻquvchilar</th>
                <th className="px-4 py-3 text-right">Davomat</th>
                <th className="px-4 py-3 text-right">Oʻrtacha baho</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr
                  key={cls.id}
                  onClick={() => open(cls)}
                  className={`cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted/50 ${
                    selected?.id === cls.id ? "bg-brand-tint/40" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{cls.name}</td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {cls.homeroom_teacher_name ?? (
                      <span className="italic">Tayinlanmagan</span>
                    )}
                  </td>
                  <td className="num px-4 py-3 text-right">{cls.student_count}</td>
                  <td
                    className={`num px-4 py-3 text-right font-medium ${
                      isAtRisk(cls.attendance_percent) ? "text-danger" : "text-success"
                    }`}
                  >
                    {cls.attendance_percent}%
                  </td>
                  <td className="num px-4 py-3 text-right">
                    {cls.average_grade > 0 ? cls.average_grade.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              {selected.name} — oʻquvchilar davomati
            </h2>
            <div className="flex gap-1.5">
              {(
                [
                  ["week", "7 kun"],
                  ["month", "30 kun"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={period === key}
                  onClick={() => {
                    setPeriod(key);
                    void loadStudents(selected, key);
                  }}
                  className={`focus-ring rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === key
                      ? "bg-brand text-brand-foreground"
                      : "border border-border text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {students === null ? (
            <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              Bu davrda davomat belgilanmagan.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => (
                <li
                  key={s.student_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm text-foreground">
                    {s.full_name}
                  </span>
                  <span
                    className={`num shrink-0 text-sm font-semibold ${
                      s.stat.total === 0
                        ? "text-foreground-muted"
                        : isAtRisk(s.stat.percent)
                          ? "text-danger"
                          : "text-success"
                    }`}
                  >
                    {s.stat.total === 0 ? "—" : `${s.stat.percent}%`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-foreground-muted">
            Qizil — davomat 85% dan past (DIR-07 boʻyicha xavf ostidagi oʻquvchi).
          </p>
        </section>
      )}
    </div>
  );
}
