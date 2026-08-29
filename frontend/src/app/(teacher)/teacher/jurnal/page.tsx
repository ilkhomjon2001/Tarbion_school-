"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { DEMO_LESSONS } from "@/lib/teacher/data";
import { hasPlan, planAt, termPlan } from "@/lib/teacher/plan";
import { classColor, TODAY } from "@/lib/teacher/schedule";
import { journalFor, type ConductedLesson } from "@/lib/teacher/store";
import { ACADEMIC_YEAR, termForDate } from "@/lib/teacher/terms";

/**
 * Sinf jurnali (JUR-01).
 *
 * Sinf × fan kesimida oʻtilgan darslar: sana, mavzu, davomat.
 * Mavzu davomat saqlanganda yoziladi — alohida kiritish shart emas,
 * ustozdan qoʻshimcha vaqt olmaydi.
 */

/** Ustoz oʻqitadigan sinf+fan juftliklari. */
const COURSES = Array.from(
  new Map(
    DEMO_LESSONS.map((l) => [`${l.className}|${l.subject}`, l]),
  ).values(),
).map((l) => ({ className: l.className, subject: l.subject }));

const ROBOTICS = [
  { className: "7-A", subject: "Robototexnika" },
  { className: "6-B", subject: "Robototexnika" },
];

const ALL_COURSES = [...COURSES, ...ROBOTICS];

export default function JournalPage() {
  const [courseKey, setCourseKey] = useState(
    `${ALL_COURSES[0].className}|${ALL_COURSES[0].subject}`,
  );
  const [entries, setEntries] = useState<ConductedLesson[] | null>(null);

  const [className, subject] = courseKey.split("|");
  const term = termForDate(TODAY);

  useEffect(() => {
    // localStorage faqat brauzerda — shuning uchun effekt ichida.
    setEntries(journalFor(className, subject));
  }, [className, subject]);

  const stats = useMemo(() => {
    const list = entries ?? [];
    const slots = list.reduce((s, e) => s + e.total, 0);
    const present = list.reduce((s, e) => s + e.present, 0);
    return {
      lessons: list.length,
      absent: list.reduce((s, e) => s + e.absent, 0),
      late: list.reduce((s, e) => s + e.late, 0),
      percent: slots ? Math.round((present / slots) * 100) : null,
    };
  }, [entries]);

  const planTotal = hasPlan(className) ? termPlan(className).length : null;

  return (
    <TeacherShell
      title="Sinf jurnali"
      subtitle={`${ACADEMIC_YEAR}${term ? ` · ${term.name}` : ""}`}
    >
      {/* Sinf + fan tanlash */}
      <div role="tablist" aria-label="Sinf va fan" className="mb-4 flex flex-wrap gap-2">
        {ALL_COURSES.map((c) => {
          const key = `${c.className}|${c.subject}`;
          const active = courseKey === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCourseKey(key)}
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active
                  ? "border-brand bg-brand-tint text-brand-dark"
                  : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${classColor(c.className).dot}`} />
              {c.className} · {c.subject}
            </button>
          );
        })}
      </div>

      {/* Xulosa */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Oʻtilgan darslar"
          value={
            entries === null
              ? "…"
              : planTotal
                ? `${stats.lessons} / ${planTotal}`
                : stats.lessons
          }
        />
        <Stat
          label="Davomat"
          value={entries === null ? "…" : stats.percent === null ? "—" : `${stats.percent}%`}
          tone="text-success"
        />
        <Stat label="Sababsiz" value={entries === null ? "…" : stats.absent} tone="text-danger" />
        <Stat label="Kechikish" value={entries === null ? "…" : stats.late} tone="text-warning" />
      </div>

      {/* Jurnal */}
      {entries === null ? (
        <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="text-base font-medium">Jurnal hali boʻsh</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-foreground-muted">
            Dars jurnalga davomat saqlanganda tushadi. Mavzu ham oʻsha yerda,
            davomat bilan birga yoziladi.
          </p>
          <Link
            href="/teacher"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Bugungi darslarga oʻtish
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">
              {className} sinfining {subject} fanidan jurnali
            </caption>
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-foreground-muted">
                <th scope="col" className="w-12 px-4 py-3 font-medium">№</th>
                <th scope="col" className="w-28 px-4 py-3 font-medium">Sana</th>
                <th scope="col" className="w-16 px-4 py-3 font-medium">Para</th>
                <th scope="col" className="px-4 py-3 font-medium">Oʻtilgan mavzu</th>
                <th scope="col" className="w-40 px-4 py-3 font-medium">Davomat</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const planned = e.planIndex !== null ? planAt(className, e.planIndex) : null;
                const offPlan = planned !== null && planned.title !== e.topic;
                return (
                  <tr
                    key={e.lessonId}
                    className="border-b border-border last:border-0 hover:bg-surface-muted/40"
                  >
                    <td className="px-4 py-2.5 text-foreground-muted">{i + 1}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{e.date}</td>
                    <td className="px-4 py-2.5 text-foreground-muted">{e.period}</td>
                    <td className="px-4 py-2.5">
                      {e.topic ? (
                        <>
                          <span>{e.topic}</span>
                          {offPlan && (
                            <span className="ml-2 rounded-full bg-warning-tint px-2 py-0.5 text-[11px] font-medium text-warning">
                              rejadan farqli
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-foreground-muted">Mavzu yozilmagan</span>
                      )}
                      {e.planIndex !== null && (
                        <span className="ml-2 text-xs text-foreground-muted">
                          ({e.planIndex + 1}-dars)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="text-success">{e.present} keldi</span>
                        {e.absent > 0 && <span className="text-danger">{e.absent} kelmadi</span>}
                        {e.excused > 0 && <span className="text-info">{e.excused} sababli</span>}
                        {e.late > 0 && <span className="text-warning">{e.late} kechikdi</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-foreground-muted">
        Jurnal davomat saqlanganda toʻldiriladi — alohida kiritish shart emas.
        Reja ham faqat shu yozuvlar boʻyicha keyingi mavzuga oʻtadi.
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
