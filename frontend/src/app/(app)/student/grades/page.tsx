import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { AttendanceCalendar } from "@/components/features/student/AttendanceCalendar";
import { SubjectGradeCard } from "@/components/features/student/SubjectGradeCard";
import { getAttendanceSummary, getSubjectGrades } from "@/lib/mock/fetchers";

export default function GradesPage() {
  return (
    <>
      <Header title="Baholar va davomat" />
      <div className="flex flex-col gap-5 p-4">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Davomat
          </h2>
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <AttendanceSection />
          </Suspense>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Fanlar boʻyicha baholar
          </h2>
          <Suspense fallback={<ListSkeleton count={4} />}>
            <GradesSection />
          </Suspense>
        </section>
      </div>
    </>
  );
}

async function AttendanceSection() {
  const summary = await getAttendanceSummary();
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {summary.monthLabel}
        </p>
        <p className="text-sm font-semibold text-brand-dark">
          {summary.percentPresent}% davomat
        </p>
      </div>
      <AttendanceCalendar
        year={2026}
        monthIndex={7}
        days={summary.days}
        todayIso="2026-08-29"
      />
    </Card>
  );
}

async function GradesSection() {
  const grades = await getSubjectGrades();
  if (grades.length === 0) {
    return <EmptyState title="Hozircha baho yoʻq" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {grades.map((summary) => (
        <SubjectGradeCard key={summary.subject} summary={summary} />
      ))}
    </div>
  );
}
