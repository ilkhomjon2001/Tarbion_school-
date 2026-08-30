import { Suspense } from "react";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ScheduleBuilder } from "@/components/director/ScheduleBuilder";
import {
  getInitialScheduleGrid,
  getSchoolClasses,
  getSubjectList,
  getTeachers,
} from "@/lib/director/fetchers";

export default function DirectorSchedulePage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-h2 font-bold text-foreground">Dars jadvali</h1>
        <p className="text-sm text-foreground-muted">
          Sinf boʻyicha haftalik dars jadvalini tuzish — katakni bosib fan, ustoz va xonani
          belgilang.
        </p>
      </div>
      <Suspense fallback={<TableSkeleton rows={9} columns={5} />}>
        <ScheduleSection />
      </Suspense>
    </div>
  );
}

async function ScheduleSection() {
  const [classes, teachers, subjects, initialGrid] = await Promise.all([
    getSchoolClasses(),
    getTeachers(),
    getSubjectList(),
    getInitialScheduleGrid(),
  ]);
  return (
    <ScheduleBuilder
      classes={classes}
      teachers={teachers}
      subjects={subjects}
      initialGrid={initialGrid}
    />
  );
}
