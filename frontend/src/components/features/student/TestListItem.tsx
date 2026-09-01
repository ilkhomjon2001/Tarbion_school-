import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { StudentTestRow } from "@/lib/student/api";

export function TestListItem({ test }: { test: StudentTestRow }) {
  const exhausted = test.attemptsUsed >= test.attemptsAllowed;

  return (
    <Link
      href={`/student/tests/${test.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-brand">{test.subject}</p>
        <p className="truncate text-sm font-medium text-foreground">{test.title}</p>
        <p className="text-xs text-foreground-muted">
          {test.durationMinutes} daqiqa · {test.questionCount} savol · urinish{" "}
          {test.attemptsUsed}/{test.attemptsAllowed}
        </p>
      </div>
      {test.lastPercent !== null ? (
        <Badge tone="brand">
          <span className="num">{test.lastPercent}%</span>
        </Badge>
      ) : exhausted ? (
        <Badge tone="neutral">Tugagan</Badge>
      ) : (
        <Badge tone="brand">Yangi</Badge>
      )}
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-muted" />
    </Link>
  );
}
