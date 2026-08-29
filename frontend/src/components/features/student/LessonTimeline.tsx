import {
  BookOpenIcon,
  ClipboardIcon,
  FlaskIcon,
  StarIcon,
} from "@/components/ui/icons";
import { Badge } from "@/components/ui/Badge";
import type { LessonSummary, ScheduleEntry } from "@/lib/types";

const PERIOD_ICONS = [BookOpenIcon, FlaskIcon, ClipboardIcon, StarIcon];
const ICON_BG = ["bg-brand", "bg-info", "bg-warning", "bg-brand-dark"];

type Lesson = LessonSummary | ScheduleEntry;

export function LessonTimeline({ lessons }: { lessons: Lesson[] }) {
  return (
    <>
      {/* Mobil: bitta ustunli chiziq */}
      <div className="flex flex-col md:hidden">
        {lessons.map((lesson, index) => (
          <div key={lesson.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepIcon index={index} />
              {index < lessons.length - 1 ? (
                <span className="w-px flex-1 bg-border" />
              ) : null}
            </div>
            <div className={`min-w-0 flex-1 ${index < lessons.length - 1 ? "pb-3" : ""}`}>
              <LessonCard lesson={lesson} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: markazdagi chiziq atrofida zigzag */}
      <div className="hidden md:flex md:flex-col">
        {lessons.map((lesson, index) => {
          const isEven = index % 2 === 0;
          const isLast = index === lessons.length - 1;
          return (
            <div key={lesson.id} className="flex items-stretch gap-4">
              <div className="w-[calc(50%-1.25rem)]">
                {isEven ? <LessonCard lesson={lesson} /> : null}
              </div>
              <div className="flex flex-col items-center">
                <StepIcon index={index} />
                {!isLast ? <span className="w-px flex-1 bg-border" /> : null}
              </div>
              <div className={`w-[calc(50%-1.25rem)] ${isLast ? "" : "pb-4"}`}>
                {!isEven ? <LessonCard lesson={lesson} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StepIcon({ index }: { index: number }) {
  const Icon = PERIOD_ICONS[index % PERIOD_ICONS.length];
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-foreground ${ICON_BG[index % ICON_BG.length]}`}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{lesson.subject}</p>
        <p className="truncate text-xs text-foreground-muted">
          {lesson.startTime} – {lesson.endTime} · {lesson.room}-xona
        </p>
      </div>
      <Badge tone="neutral">{lesson.periodNumber}-dars</Badge>
    </div>
  );
}
