import Link from "next/link";
import { estimateQuarterGrade } from "@/lib/grades";
import { GRADE_KIND_LABELS } from "@/lib/labels";
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
  const quarterEstimate = estimateQuarterGrade(summary.entries);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {summary.subject}
        </h3>
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span>
            Oʻrtacha:{" "}
            <span className="text-sm font-semibold text-brand-dark">
              {summary.average.toFixed(1)}
            </span>
          </span>
          {quarterEstimate > 0 ? (
            <span>
              Chorak (taxmin):{" "}
              <span className="text-sm font-semibold text-brand-dark">{quarterEstimate}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {summary.entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/student/grades/${entry.id}`}
            title={`${GRADE_KIND_LABELS[entry.kind]} · ${entry.date}`}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
              GRADE_DOT_CLASSES[entry.value] ?? "bg-surface-muted text-foreground"
            }`}
          >
            {entry.value}
          </Link>
        ))}
      </div>
    </div>
  );
}
