"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { DEMO_DATE_LABEL } from "@/lib/teacher/data";
import { getTodayLessons } from "@/lib/teacher/store";
import type { TeacherLesson } from "@/lib/teacher/types";

/** Davomat boʻlimi: qaysi darsning davomatini belgilashni tanlash. */
export default function AttendanceIndexPage() {
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

  return (
    <TeacherShell title="Davomat" subtitle={DEMO_DATE_LABEL}>
      {lessons === null ? (
        <div className="space-y-3" aria-busy="true" aria-label="Yuklanmoqda">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="text-base font-medium">Bugun darsingiz yoʻq</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/teacher/davomat/${lesson.id}`}
                className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-surface-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand-dark">
                    {lesson.className}
                  </span>
                  {lesson.presentCount === null ? (
                    <span className="text-xs text-foreground-muted">Belgilanmagan</span>
                  ) : (
                    <span className="text-xs text-success">
                      {lesson.presentCount}/{lesson.studentCount}
                    </span>
                  )}
                </div>

                <p className="mt-2 font-medium">{lesson.subject}</p>
                <p className="mt-0.5 text-sm text-foreground-muted">
                  {lesson.period}-para · {lesson.startTime}–{lesson.endTime}
                </p>
                <p className="text-sm text-foreground-muted">{lesson.room}</p>

                {!lesson.editable && (
                  <p className="mt-2 text-xs text-warning">Tahrirlash muddati tugagan</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}
