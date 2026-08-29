import { ATTENDANCE_LABELS } from "@/lib/labels";
import type { AttendanceDay } from "@/lib/types";

const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const DOT_CLASSES: Record<AttendanceDay["status"], string> = {
  present: "bg-success",
  absent: "bg-danger",
  excused: "bg-info",
  late: "bg-warning",
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
}: {
  year: number;
  monthIndex: number;
  days: AttendanceDay[];
}) {
  const cells = buildMonthGrid(year, monthIndex);
  const byDate = new Map(days.map((d) => [d.date, d]));

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-foreground-muted">
        {WEEKDAY_SHORT.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }
          const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const record = byDate.get(iso);
          return (
            <div
              key={iso}
              title={record ? ATTENDANCE_LABELS[record.status] : undefined}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs ${
                record ? "bg-surface-muted font-medium text-foreground" : "text-foreground-muted"
              }`}
            >
              <span>{day}</span>
              {record ? (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${DOT_CLASSES[record.status]}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-foreground-muted">
        {(Object.keys(ATTENDANCE_LABELS) as (keyof typeof ATTENDANCE_LABELS)[]).map(
          (status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[status]}`} />
              {ATTENDANCE_LABELS[status]}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
