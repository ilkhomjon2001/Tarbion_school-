import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { TeacherProfileTabs } from "@/components/director/TeacherProfileTabs";
import {
  getClassesTaughtBy,
  getTeacher,
  getTeacherStats,
  getTeacherWeeklySchedule,
} from "@/lib/director/fetchers";

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await getTeacher(id);
  if (!teacher) notFound();

  const [stats, classes, weeklySchedule] = await Promise.all([
    getTeacherStats(id),
    getClassesTaughtBy(id),
    getTeacherWeeklySchedule(id),
  ]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <Card>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-tint text-lg font-semibold text-brand-dark">
            {teacher.avatarInitials}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-h2 font-bold text-foreground">{teacher.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-muted">
              <span>{teacher.subjects.join(", ")}</span>
              <span>{teacher.phone}</span>
              <span>{teacher.email}</span>
            </div>
          </div>
        </div>
      </Card>

      <TeacherProfileTabs weeklySchedule={weeklySchedule} classes={classes} stats={stats} />
    </div>
  );
}
