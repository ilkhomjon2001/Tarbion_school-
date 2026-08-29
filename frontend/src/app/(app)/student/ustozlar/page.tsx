import { Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { subjectColor } from "@/lib/subject-colors";
import { getCurrentStudent } from "@/lib/mock/fetchers";
import { subjectTeachersOf } from "@/lib/school/staff";

export default function StudentTeachersPage() {
  return (
    <>
      <Header title="Ustozlar" />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="hidden md:block">
          <h1 className="text-h2 font-bold text-foreground">Ustozlar</h1>
          <p className="text-sm text-foreground-muted">
            Sinfingizdagi fanlar va ularning oʻqituvchilari
          </p>
        </div>

        <Suspense fallback={<ListSkeleton count={5} />}>
          <TeacherList />
        </Suspense>
      </div>
    </>
  );
}

async function TeacherList() {
  const student = await getCurrentStudent();
  const subjectTeachers = subjectTeachersOf(student.className);

  if (subjectTeachers.length === 0) {
    return (
      <EmptyState
        title="Ustozlar roʻyxati boʻsh"
        description="Sinfingiz uchun dars jadvali hali toʻldirilmagan."
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {subjectTeachers.map(({ subject, teacher, hoursPerWeek, isHomeroom }) => (
        <li key={`${subject}-${teacher.id}`}>
          <Card className="flex h-full items-start gap-3">
            <span
              aria-hidden
              className={`mt-0.5 h-10 w-1.5 shrink-0 rounded-full ${subjectColor(subject).dot}`}
            />
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-dark">
              {teacher.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{subject}</p>
                {isHomeroom && <Badge tone="brand">Sinf rahbari</Badge>}
              </div>
              <p className="mt-0.5 truncate text-sm text-foreground">{teacher.fullName}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                Haftasiga <span className="num">{hoursPerWeek}</span> soat
              </p>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
