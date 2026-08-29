import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { HOMEWORK_LABELS, HOMEWORK_TONE } from "@/lib/labels";
import type { Homework } from "@/lib/types";

export function HomeworkListItem({ homework }: { homework: Homework }) {
  return (
    <Link
      href={`/student/homework/${homework.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-brand">{homework.subject}</p>
        <p className="truncate text-sm font-medium text-foreground">
          {homework.title}
        </p>
        <p className="text-xs text-foreground-muted">
          Muddat: {formatDate(homework.dueDate)}
        </p>
      </div>
      <Badge tone={HOMEWORK_TONE[homework.status]}>
        {HOMEWORK_LABELS[homework.status]}
      </Badge>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-muted" />
    </Link>
  );
}
