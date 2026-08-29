import type { RankingEntry } from "@/lib/types";

const MEDAL_CLASSES: Record<number, string> = {
  1: "bg-warning-tint text-warning",
  2: "bg-surface-muted text-foreground-muted",
  3: "bg-brand-tint text-brand-dark",
};

export function RankingList({ entries }: { entries: RankingEntry[] }) {
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div
          key={entry.studentId}
          className={`flex items-center gap-3 rounded-xl border p-3 ${
            entry.isCurrentUser
              ? "border-brand bg-brand-tint"
              : "border-border bg-surface"
          }`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              MEDAL_CLASSES[entry.rank] ?? "bg-surface-muted text-foreground-muted"
            }`}
          >
            {entry.rank}
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {initials(entry.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {entry.fullName}
              {entry.isCurrentUser ? (
                <span className="ml-1.5 text-xs font-normal text-brand-dark">(siz)</span>
              ) : null}
            </p>
            <p className="text-xs text-foreground-muted">
              Baho: {entry.averageGrade.toFixed(1)} · Davomat: {entry.attendancePercent}%
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-brand-dark">
            {entry.score.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
