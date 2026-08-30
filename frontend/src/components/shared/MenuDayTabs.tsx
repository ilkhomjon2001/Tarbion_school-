"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { MealCard } from "@/components/shared/MealCard";
import { formatDate, formatWeekday } from "@/lib/format";
import type { DailyMenu } from "@/lib/types";

const TODAY_ISO = "2026-08-29";

export function MenuDayTabs({ days }: { days: DailyMenu[] }) {
  const [selectedDate, setSelectedDate] = useState(
    days.some((d) => d.date === TODAY_ISO) ? TODAY_ISO : days[0]?.date,
  );
  const selected = days.find((d) => d.date === selectedDate);

  return (
    <div>
      <div role="tablist" aria-label="Kunlar" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => {
          const isActive = day.date === selectedDate;
          const isToday = day.date === TODAY_ISO;
          return (
            <button
              key={day.date}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedDate(day.date)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                isActive
                  ? "border-brand bg-brand-tint text-brand-dark"
                  : "border-border text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {formatWeekday(day.date).slice(0, 2)}, {formatDate(day.date)}
              {isToday ? " · bugun" : ""}
            </button>
          );
        })}
      </div>

      {!selected || selected.meals.length === 0 ? (
        <EmptyState title={selected?.note ?? "Bu kun uchun menyu yoʻq"} />
      ) : (
        <div className="flex flex-col gap-2">
          {selected.meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} />
          ))}
        </div>
      )}
    </div>
  );
}
