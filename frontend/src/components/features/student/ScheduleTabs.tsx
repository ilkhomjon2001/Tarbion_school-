"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LessonRow } from "@/components/features/student/LessonRow";
import { WEEKDAY_LABELS } from "@/lib/format";
import type { ScheduleEntry } from "@/lib/types";

const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

export function ScheduleTabs({ entries }: { entries: ScheduleEntry[] }) {
  const [selectedDay, setSelectedDay] = useState(1);
  const dayEntries = entries
    .filter((e) => e.dayOfWeek === selectedDay)
    .sort((a, b) => a.periodNumber - b.periodNumber);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Hafta kunlari"
        className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1"
      >
        {WEEKDAY_SHORT.map((label, index) => {
          const day = index + 1;
          const isActive = day === selectedDay;
          return (
            <button
              key={day}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setSelectedDay(day)}
              className={`min-w-[44px] flex-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                isActive
                  ? "bg-surface text-brand shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-sm font-medium text-foreground-muted">
        {WEEKDAY_LABELS[selectedDay - 1]}
      </p>

      {dayEntries.length === 0 ? (
        <EmptyState title="Bu kuni dars yoʻq" />
      ) : (
        <div className="flex flex-col gap-2">
          {dayEntries.map((entry) => (
            <LessonRow key={entry.id} lesson={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
