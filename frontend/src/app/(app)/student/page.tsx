"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { CheckSquareIcon } from "@/components/ui/icons";
import { LessonTimeline } from "@/components/features/student/LessonTimeline";
import { AttendanceCalendar } from "@/components/features/student/AttendanceCalendar";
import { messageOf } from "@/components/shared/LiveSession";
import { GRADE_KIND_LABELS } from "@/lib/labels";
import { formatDate, formatWeekday } from "@/lib/format";
import {
  fetchAttendanceSummary,
  fetchScheduleForClass,
  fetchStudentMe,
  fetchSubjectGrades,
  localIso,
  todayLessonsOf,
  type StudentMe,
} from "@/lib/student/api";
import type {
  AttendanceSummary,
  GradeEntry,
  LessonSummary,
} from "@/lib/types";

/**
 * Oʻquvchi bosh sahifasi — BAZADAN (T-034).
 *
 * Reyting va eʼlonlar boʻlimlari bu yerda YOʻQ: ularning backend'i hali
 * yozilmagan (T-020) va haqiqiy baho yonida soxta reyting koʻrsatish
 * chalgʻitardi. Backend chiqqach qaytariladi.
 */
export default function StudentHomePage() {
  const [me, setMe] = useState<StudentMe | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [recentGrades, setRecentGrades] = useState<GradeEntry[] | null>(null);
  const [error, setError] = useState("");

  const today = new Date();

  useEffect(() => {
    void (async () => {
      try {
        const who = await fetchStudentMe();
        setMe(who);
        if (!who.studentId) return;

        const now = new Date();
        const [schedule, attendance, grades] = await Promise.all([
          who.classId ? fetchScheduleForClass(who.classId) : Promise.resolve([]),
          fetchAttendanceSummary(who.studentId, now.getFullYear(), now.getMonth()),
          fetchSubjectGrades(who.studentId),
        ]);
        setLessons(todayLessonsOf(schedule, now));
        setSummary(attendance);
        setRecentGrades(
          grades
            .flatMap((s) => s.entries)
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 3),
        );
      } catch (err) {
        setError(messageOf(err));
      }
    })();
  }, []);

  if (me && !me.studentId) {
    return (
      <>
        <Header title="Bosh sahifa" />
        <div className="p-4">
          <EmptyState
            title="Hisobingizga oʻquvchi yozuvi biriktirilmagan"
            description="Administratorga murojaat qiling."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Bosh sahifa" />
      <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-3 lg:gap-6 lg:p-6">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {error && (
            <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {me ? (
            <div>
              <h1 className="text-h1 font-bold text-foreground">
                Assalomu alaykum, {me.fullName}
              </h1>
              <p className="mt-1 text-sm text-foreground-muted">
                Bugun {formatDate(localIso(today))}, {formatWeekday(localIso(today))}.
                Oʻqishlaringizga omad tilaymiz!
              </p>
            </div>
          ) : (
            <Card className="h-16 animate-pulse" />
          )}

          {lessons && summary ? (
            <Card className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-tint text-success">
                <CheckSquareIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  Bugungi holat
                </p>
                <p className="truncate text-lg font-bold text-foreground">
                  {lessons.length > 0
                    ? `Bugun ${lessons.length} ta darsingiz bor`
                    : "Bugun dars yoʻq"}
                </p>
                <p className="text-sm font-semibold text-success">
                  {summary.monthLabel} davomati: {summary.percentPresent}%
                </p>
              </div>
            </Card>
          ) : (
            <Card className="h-20 animate-pulse" />
          )}

          <section>
            <SectionTitle title="Bugungi dars jadvali" href="/student/schedule" />
            {lessons === null ? (
              <ListSkeleton count={3} />
            ) : lessons.length === 0 ? (
              <EmptyState
                title="Bugun dars yoʻq"
                description="Dam olishdan bahramand boʻling."
              />
            ) : (
              <Card>
                <LessonTimeline lessons={lessons} />
              </Card>
            )}
          </section>

          <section>
            <SectionTitle title="Oylik davomat" href="/student/grades" />
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
        </div>

        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Oylik statistika</h2>
            {summary === null ? (
              <Card className="h-64 animate-pulse" />
            ) : (
              <MonthlyStats summary={summary} />
            )}
          </section>

          <section>
            <SectionTitle title="Soʻnggi baholar" href="/student/grades" />
            {recentGrades === null ? (
              <ListSkeleton count={2} />
            ) : recentGrades.length === 0 ? (
              <EmptyState title="Hozircha baho yoʻq" />
            ) : (
              <div className="flex flex-col gap-2">
                {recentGrades.map((grade) => (
                  <Link
                    key={grade.id}
                    href="/student/grades"
                    className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{grade.subject}</p>
                      <p className="text-xs text-foreground-muted">
                        {GRADE_KIND_LABELS[grade.kind]}
                      </p>
                    </div>
                    <Badge tone="brand">{grade.value}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <Link
        href={href}
        className="text-xs font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        Barchasini koʻrish
      </Link>
    </div>
  );
}

function MonthlyStats({ summary }: { summary: AttendanceSummary }) {
  const counts = { present: 0, absent: 0, other: 0 };
  for (const day of summary.days) {
    if (day.status === "present") counts.present += 1;
    else if (day.status === "absent") counts.absent += 1;
    else counts.other += 1;
  }
  return (
    <Card>
      <ProgressRing percent={summary.percentPresent} label="Davomat" />
      <div className="mt-4 flex flex-col gap-2 text-sm">
        <StatRow dotClassName="bg-success" label="Bor" value={`${counts.present} kun`} />
        <StatRow dotClassName="bg-danger" label="Yoʻq" value={`${counts.absent} kun`} />
        <StatRow
          dotClassName="bg-warning"
          label="Sababli/Kechikdi"
          value={`${counts.other} kun`}
        />
      </div>
    </Card>
  );
}

function StatRow({
  dotClassName,
  label,
  value,
}: {
  dotClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-foreground-muted">
        <span className={`h-2 w-2 rounded-full ${dotClassName}`} />
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
