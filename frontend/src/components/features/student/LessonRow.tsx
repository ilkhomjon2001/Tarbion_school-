import type { LessonSummary, ScheduleEntry } from "@/lib/types";

export function LessonRow({
  lesson,
}: {
  lesson: LessonSummary | ScheduleEntry;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-tint text-brand-dark">
        <span className="text-sm font-semibold leading-none">
          {lesson.periodNumber}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {lesson.subject}
        </p>
        <p className="truncate text-xs text-foreground-muted">
          {lesson.teacherName} · {lesson.room}-xona
        </p>
      </div>
      <div className="shrink-0 text-right text-xs text-foreground-muted">
        <p>{lesson.startTime}</p>
        <p>{lesson.endTime}</p>
      </div>
    </div>
  );
}
