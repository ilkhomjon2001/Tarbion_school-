"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { AttendanceCalendar } from "@/components/features/student/AttendanceCalendar";
import { SubjectGradeCard } from "@/components/features/student/SubjectGradeCard";
import { messageOf } from "@/components/shared/LiveSession";
import {
  fetchAttendanceSummary,
  fetchStudentMe,
  fetchSubjectGrades,
  fetchTermGrades,
  localIso,
} from "@/lib/student/api";
import type { StudentTermGradeOut } from "@/lib/api/types.gen";
import type { AttendanceSummary, SubjectGradeSummary } from "@/lib/types";

/**
 * Baholar va davomat — BAZADAN (JUR-05, OTA-03 ning oʻquvchi tomoni).
 *
 * Imtihonlar boʻlimi bu yerda YOʻQ: imtihon moduli backend'da hali
 * yozilmagan — haqiqiy baho yonida soxta natija koʻrsatilmaydi.
 */
export default function GradesPage() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [grades, setGrades] = useState<SubjectGradeSummary[] | null>(null);
  const [terms, setTerms] = useState<StudentTermGradeOut[]>([]);
  const [error, setError] = useState("");

  const today = new Date();

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.studentId) {
          setGrades([]);
          return;
        }
        const now = new Date();
        const [attendance, subjectGrades, termGrades] = await Promise.all([
          fetchAttendanceSummary(me.studentId, now.getFullYear(), now.getMonth()),
          fetchSubjectGrades(me.studentId),
          fetchTermGrades(me.studentId),
        ]);
        setSummary(attendance);
        setGrades(subjectGrades);
        setTerms(termGrades);
      } catch (err) {
        setError(messageOf(err));
      }
    })();
  }, []);

  return (
    <>
      <Header title="Baholar va davomat" />
      <div className="flex flex-col gap-5 p-4">
        {error && (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Chorak bahosi — faqat yakunlanganlari (JUR-04). */}
        {terms.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Chorak baholari
            </h2>
            <Card>
              <ul className="flex flex-wrap gap-2">
                {terms.map((t) => (
                  <li
                    key={`${t.term_id}-${t.subject_id}`}
                    className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
                  >
                    <span className="text-sm">
                      {t.subject_name}
                      <span className="ml-1 text-xs text-foreground-muted">
                        {t.term_name}
                      </span>
                    </span>
                    <span className="num inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted text-sm font-bold text-foreground">
                      {t.value}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Davomat</h2>
          {summary === null ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{summary.monthLabel}</p>
                <p className="text-sm font-semibold text-brand-dark">
                  {summary.percentPresent}% davomat
                </p>
              </div>
              <AttendanceCalendar
                year={today.getFullYear()}
                monthIndex={today.getMonth()}
                days={summary.days}
                todayIso={localIso(today)}
              />
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Fanlar boʻyicha baholar
          </h2>
          {grades === null ? (
            <ListSkeleton count={4} />
          ) : grades.length === 0 ? (
            <EmptyState title="Hozircha baho yoʻq" />
          ) : (
            <div className="flex flex-col gap-2">
              {grades.map((summaryItem) => (
                <SubjectGradeCard key={summaryItem.subject} summary={summaryItem} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
