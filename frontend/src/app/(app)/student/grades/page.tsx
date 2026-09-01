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
  localIso,
} from "@/lib/student/api";
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
        const [attendance, subjectGrades] = await Promise.all([
          fetchAttendanceSummary(me.studentId, now.getFullYear(), now.getMonth()),
          fetchSubjectGrades(me.studentId),
        ]);
        setSummary(attendance);
        setGrades(subjectGrades);
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
