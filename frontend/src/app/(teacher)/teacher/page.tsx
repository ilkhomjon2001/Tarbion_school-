"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { TodaySummary } from "@/components/teacher/TodaySummary";
import { todayLabel } from "@/lib/teacher/me";
import { getTodayLessons } from "@/lib/teacher/attendance-api";
import type { TeacherLesson } from "@/lib/teacher/types";

/** Ustoz bosh sahifasi: bugungi darslar, qaysi sinf va qaysi xonada. */
export default function TeacherTodayPage() {
  const [lessons, setLessons] = useState<TeacherLesson[] | null>(null);

  useEffect(() => {
    let alive = true;
    getTodayLessons().then((data) => {
      if (alive) setLessons(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const marked = lessons?.filter((l) => l.presentCount !== null).length ?? 0;
  const total = lessons?.length ?? 0;

  return (
    <TeacherShell title="Bugungi darslar" subtitle={todayLabel()}>
      {/* Kutilayotgan ishlar — ustoz nima qilishi kerakligini darhol koʻrsin */}
      <TodaySummary lessons={lessons} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section>
          {lessons === null ? (
            <TableSkeleton />
          ) : lessons.length === 0 ? (
            <EmptyToday />
          ) : (
            <>
              {/* Katta ekran: jadval */}
              <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">Bugungi darslar roʻyxati</caption>
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-foreground-muted">
                      <th scope="col" className="px-4 py-3 font-medium">Para</th>
                      <th scope="col" className="px-4 py-3 font-medium">Vaqt</th>
                      <th scope="col" className="px-4 py-3 font-medium">Sinf</th>
                      <th scope="col" className="px-4 py-3 font-medium">Fan</th>
                      <th scope="col" className="px-4 py-3 font-medium">Xona</th>
                      <th scope="col" className="px-4 py-3 font-medium">Holat</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Amal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((lesson) => (
                      <tr
                        key={lesson.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-surface-muted/50"
                      >
                        <td className="px-4 py-3 font-medium">{lesson.period}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-foreground-muted">
                          {lesson.startTime} – {lesson.endTime}
                        </td>
                        <td className="px-4 py-3 font-medium">{lesson.className}</td>
                        <td className="px-4 py-3">{lesson.subject}</td>
                        <td className="px-4 py-3 text-foreground-muted">{lesson.room}</td>
                        <td className="px-4 py-3">
                          <StatusBadge lesson={lesson} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <LessonAction lesson={lesson} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Kichik ekran: kartalar (NFR-03) */}
              <ul className="space-y-3 md:hidden">
                {lessons.map((lesson) => (
                  <li
                    key={lesson.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {lesson.period}-para · {lesson.className}
                        </p>
                        <p className="text-sm text-foreground-muted">
                          {lesson.subject} · {lesson.room}
                        </p>
                        <p className="mt-0.5 text-sm text-foreground-muted">
                          {lesson.startTime} – {lesson.endTime}
                        </p>
                      </div>
                      <StatusBadge lesson={lesson} />
                    </div>
                    <div className="mt-3">
                      <LessonAction lesson={lesson} full />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Yon panel: kunlik xulosa */}
        <aside className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Kunlik xulosa</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-foreground-muted">Jami darslar</dt>
              <dd className="font-semibold">{lessons === null ? "…" : total}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-foreground-muted">Belgilangan</dt>
              <dd className="font-semibold text-success">
                {lessons === null ? "…" : marked}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-foreground-muted">Kutilayotgan</dt>
              <dd className="font-semibold text-warning">
                {lessons === null ? "…" : total - marked}
              </dd>
            </div>
          </dl>

          {lessons !== null && total > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-foreground-muted">
                <span>Davomat koʻrsatkichi</span>
                <span className="num">{Math.round((marked / total) * 100)}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={marked}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label="Belgilangan darslar ulushi"
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${(marked / total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </aside>
      </div>
    </TeacherShell>
  );
}

function StatusBadge({ lesson }: { lesson: TeacherLesson }) {
  if (lesson.presentCount === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground-muted">
        Belgilanmagan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2.5 py-1 text-xs font-medium text-success">
      <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12l6 6L20 6" />
      </svg>
      {lesson.presentCount}/{lesson.studentCount} belgilangan
    </span>
  );
}

function LessonAction({ lesson, full }: { lesson: TeacherLesson; full?: boolean }) {
  const base =
    "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  const width = full ? "w-full" : "";

  if (!lesson.editable) {
    return (
      <Link
        href={`/teacher/davomat/${lesson.id}`}
        className={`${base} ${width} border border-border text-foreground-muted hover:bg-surface-muted`}
      >
        Koʻrish
      </Link>
    );
  }

  return (
    <Link
      href={`/teacher/davomat/${lesson.id}`}
      className={`${base} ${width} bg-brand text-brand-foreground hover:bg-brand-dark`}
    >
      {lesson.presentCount === null ? "Davomat belgilash" : "Tahrirlash"}
    </Link>
  );
}

function EmptyToday() {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
      <p className="text-base font-medium">Bugun darsingiz yoʻq</p>
      <p className="mt-1 text-sm text-foreground-muted">
        Sizda bugun uchun hech qanday dars belgilanmagan.
      </p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Yuklanmoqda">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-surface" />
      ))}
    </div>
  );
}
