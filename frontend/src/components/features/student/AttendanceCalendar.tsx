import { CheckIcon, ClockIcon, XIcon } from "@/components/ui/icons";
import { ATTENDANCE_LABELS } from "@/lib/labels";
import type { AttendanceDay } from "@/lib/types";

const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const STATUS_STYLE: Record<
  AttendanceDay["status"],
  { icon: typeof CheckIcon; className: string; cellClassName: string }
> = {
  present: {
    icon: CheckIcon,
    className: "text-success",
    cellClassName: "bg-success-tint",
  },
  absent: {
    icon: XIcon,
    className: "text-danger",
    cellClassName: "bg-danger-tint",
  },
  excused: {
    icon: ClockIcon,
    className: "text-info",
    cellClassName: "bg-info-tint",
  },
  late: {
    icon: ClockIcon,
    className: "text-warning",
    cellClassName: "bg-warning-tint",
  },
};

function buildMonthGrid(year: number, monthIndex: number) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // 0 = Dushanba

  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function AttendanceCalendar({
  year,
  monthIndex,
  days,
  todayIso,
}: {
  year: number;
  monthIndex: number;
  days: AttendanceDay[];
  todayIso?: string;
}) {
  const cells = buildMonthGrid(year, monthIndex);
  const byDate = new Map(days.map((d) => [d.date, d]));

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-foreground-muted">
        {WEEKDAY_SHORT.map((w) => (
          <span key={w} className="rounded-md bg-surface-muted py-1.5">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }
          const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const record = byDate.get(iso);
          const isToday = iso === todayIso;
          const status = record ? STATUS_STYLE[record.status] : null;
          const StatusIcon = status?.icon;
          return (
            <div
              key={iso}
              title={record ? ATTENDANCE_LABELS[record.status] : undefined}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-xs ${
                isToday ? "border-2 border-brand" : "border-border"
              } ${status ? status.cellClassName : ""}`}
            >
              <span className="font-medium text-foreground">{day}</span>
              {StatusIcon ? (
                <StatusIcon className={`h-3.5 w-3.5 ${status!.className}`} strokeWidth={2.5} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-foreground-muted">
        {(Object.keys(ATTENDANCE_LABELS) as (keyof typeof ATTENDANCE_LABELS)[]).map(
          (status) => {
            const StatusIcon = STATUS_STYLE[status].icon;
            return (
              <span key={status} className="flex items-center gap-1.5">
                <StatusIcon className={`h-3.5 w-3.5 ${STATUS_STYLE[status].className}`} />
                {ATTENDANCE_LABELS[status]}
              </span>
            );
          },
        )}
      </div>
    </div>
  );
}
