"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { HomeworkListItem } from "@/components/features/student/HomeworkListItem";
import { HOMEWORK_LABELS } from "@/lib/labels";
import type { Homework, HomeworkStatus } from "@/lib/types";

const FILTERS: { key: HomeworkStatus | "all"; label: string }[] = [
  { key: "all", label: "Barchasi" },
  { key: "assigned", label: HOMEWORK_LABELS.assigned },
  { key: "submitted", label: HOMEWORK_LABELS.submitted },
  { key: "graded", label: HOMEWORK_LABELS.graded },
  { key: "late", label: HOMEWORK_LABELS.late },
];

export function HomeworkFilterList({ items }: { items: Homework[] }) {
  const [filter, setFilter] = useState<HomeworkStatus | "all">("assigned");
  const filtered =
    filter === "all" ? items : items.filter((item) => item.status === filter);

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(({ key, label }) => {
          const isActive = key === filter;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                isActive
                  ? "border-brand bg-brand-tint text-brand-dark"
                  : "border-border text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Bu boʻlimda vazifa yoʻq" />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((homework) => (
            <HomeworkListItem key={homework.id} homework={homework} />
          ))}
        </div>
      )}
    </div>
  );
}
