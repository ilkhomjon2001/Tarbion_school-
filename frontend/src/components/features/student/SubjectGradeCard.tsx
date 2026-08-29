import { GRADE_TYPE_LABELS } from "@/lib/labels";
import type { SubjectGradeSummary } from "@/lib/types";

const GRADE_DOT_CLASSES: Record<number, string> = {
  5: "bg-success-tint text-success",
  4: "bg-brand-tint text-brand-dark",
  3: "bg-warning-tint text-warning",
  2: "bg-danger-tint text-danger",
};

export function SubjectGradeCard({
  summary,
}: {
  summary: SubjectGradeSummary;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {summary.subject}
        </h3>
        <span className="text-sm font-semibold text-brand-dark">
          {summary.average.toFixed(1)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {summary.entries.map((entry) => (
          <div
            key={entry.id}
            title={`${GRADE_TYPE_LABELS[entry.type]} · ${entry.date}`}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
              GRADE_DOT_CLASSES[entry.value] ?? "bg-surface-muted text-foreground"
            }`}
          >
            {entry.value}
          </div>
        ))}
      </div>
    </div>
  );
}
