"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { buildInitialRows } from "@/lib/teacher/data";
import {
  BELL_SCHEDULE,
  buildLessons,
  classColor,
  TODAY,
} from "@/lib/teacher/schedule";
import { ATTENDANCE_LETTERS, type AttendanceStatus } from "@/lib/teacher/types";

/**
 * Sinf rahbarining "Sinflarim" boʻlimi (DAV-02, ADM-02).
 *
 * Sinf rahbari oʻz sinfi boʻyicha ustozdan kengroq huquqqa ega: butun
 * kunlik davomatni bitta ekranda koʻradi (oʻquvchilar × paralar
 * matritsasi) va oʻquvchilar roʻyxatini boshqaradi.
 */

/** Demo: shu ustoz sinf rahbari boʻlgan sinflar. */
const MY_CLASSES = ["11-A"];

/** Kunlik davomat matritsasi uchun demo holatlar. */
const DEMO_STATUSES: Record<string, AttendanceStatus> = {
  "11-A-2|1": "absent",
  "11-A-2|2": "absent",
  "11-A-4|4": "late",
  "11-A-7|1": "excused",
  "11-A-7|2": "excused",
  "11-A-11|6": "late",
};

const STATUS_CELL: Record<AttendanceStatus, string> = {
  present: "bg-success-tint text-success",
  absent: "bg-danger text-brand-foreground",
  excused: "bg-info-tint text-info",
  late: "bg-warning-tint text-warning",
};

export default function MyClassesPage() {
  const [selected, setSelected] = useState(MY_CLASSES[0]);

  const students = useMemo(() => buildInitialRows(selected), [selected]);

  // Shu sinfning bugungi paralari.
  const periods = useMemo(() => {
    const day = new Date(`${TODAY}T00:00:00`);
    return buildLessons(day, day)
      .filter((l) => l.className === selected)
      .sort((a, b) => a.period - b.period);
  }, [selected]);

  function statusOf(studentId: string, period: number): AttendanceStatus {
    return DEMO_STATUSES[`${studentId}|${period}`] ?? "present";
  }

  const summary = useMemo(() => {
    let absent = 0;
    let late = 0;
    let excused = 0;
    for (const s of students) {
      for (const p of periods) {
        const st = statusOf(s.studentId, p.period);
        if (st === "absent") absent += 1;
        else if (st === "late") late += 1;
        else if (st === "excused") excused += 1;
      }
    }
    const total = students.length * periods.length;
    const present = total - absent - late - excused;
    return { total, present, absent, late, excused };
  }, [students, periods]);

  return (
    <TeacherShell
      title="Sinflarim"
      subtitle={`Sinf rahbari · ${selected} · ${students.length} oʻquvchi`}
    >
      {MY_CLASSES.length > 1 && (
        <div role="tablist" aria-label="Sinf tanlash" className="mb-4 flex gap-2">
          {MY_CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={selected === c}
              onClick={() => setSelected(c)}
              className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                selected === c
                  ? "border-brand bg-brand-tint text-brand-dark"
                  : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* --- Kunlik xulosa --- */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Oʻquvchilar" value={students.length} />
        <Stat
          label="Qatnashdi"
          value={`${summary.total ? Math.round((summary.present / summary.total) * 100) : 100}%`}
          tone="text-success"
        />
        <Stat label="Sababsiz qoldirdi" value={summary.absent} tone="text-danger" />
        <Stat label="Kechikdi" value={summary.late} tone="text-warning" />
      </div>

      {/* --- Kunlik davomat gridi (DAV-02) --- */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-sm font-semibold">
          Kunlik davomat · butun sinf
        </h2>

        {periods.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center text-sm text-foreground-muted">
            Bu sinfda bugun dars yoʻq.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">
                {selected} sinfining bugungi davomati — oʻquvchilar va paralar kesimida
              </caption>
              <thead>
                <tr className="border-b border-border bg-surface-muted/60">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-surface-muted px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted"
                  >
                    F.I.Sh.
                  </th>
                  {periods.map((p) => (
                    <th
                      key={p.id}
                      scope="col"
                      className="px-2 py-2 text-center text-xs font-medium text-foreground-muted"
                    >
                      <span className="block">{p.period}-para</span>
                      <span className="block text-[10px] font-normal">
                        {BELL_SCHEDULE[p.period].start}
                      </span>
                      <span className="block text-[10px] font-normal">{p.subject}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-foreground-muted">
                    Foiz
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const present = periods.filter(
                    (p) => statusOf(s.studentId, p.period) === "present",
                  ).length;
                  const pct = periods.length
                    ? Math.round((present / periods.length) * 100)
                    : 100;
                  return (
                    <tr key={s.studentId} className="border-b border-border last:border-0">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 text-left font-normal"
                      >
                        {s.fullName}
                      </th>
                      {periods.map((p) => {
                        const st = statusOf(s.studentId, p.period);
                        return (
                          <td key={p.id} className="px-2 py-1.5 text-center">
                            <span
                              title={`${p.period}-para: ${st}`}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${STATUS_CELL[st]}`}
                            >
                              {ATTENDANCE_LETTERS[st]}
                            </span>
                          </td>
                        );
                      })}
                      <td
                        className={`px-3 py-1.5 text-center text-sm font-medium ${
                          pct < 80 ? "text-danger" : "text-foreground-muted"
                        }`}
                      >
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Izoh — rang yolgʻiz maʼno tashimasin */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground-muted">
          <span className="font-medium">Izoh:</span>
          {(
            [
              ["present", "Keldi"],
              ["absent", "Kelmadi"],
              ["excused", "Sababli"],
              ["late", "Kechikdi"],
            ] as const
          ).map(([st, label]) => (
            <span key={st} className="inline-flex items-center gap-1.5">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${STATUS_CELL[st]}`}
              >
                {ATTENDANCE_LETTERS[st]}
              </span>
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* --- Oʻquvchilar roʻyxati --- */}
      <section>
        <h2 className="mb-2.5 text-sm font-semibold">Oʻquvchilar roʻyxati</h2>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((s, i) => (
            <li
              key={s.studentId}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${classColor(selected).block}`}
              >
                {s.fullName.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.fullName}</span>
                <span className="block text-xs text-foreground-muted">
                  {i + 1}-raqam · {selected}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-5 text-sm text-foreground-muted">
        Davomatni oʻzgartirish uchun{" "}
        <Link
          href="/teacher"
          className="text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          bugungi darslar
        </Link>{" "}
        boʻlimiga oʻting.
      </p>
    </TeacherShell>
  );
}

function Stat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-foreground-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
