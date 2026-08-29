"use client";

import { useState } from "react";
import type { NotificationPreferences } from "@/lib/types";

const OPTIONS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  {
    key: "newGrade",
    label: "Yangi baho",
    description: "Ustoz sizga baho qoʻyganda xabar bering.",
  },
  {
    key: "homeworkReminder",
    label: "Uy vazifasi eslatmasi",
    description: "Yangi vazifa berilganda va muddat yaqinlashganda.",
  },
  {
    key: "announcements",
    label: "Eʼlonlar",
    description: "Maktab yoki sinf eʼlon chop etganda.",
  },
];

export function NotificationPreferencesForm({
  initial,
}: {
  initial: NotificationPreferences;
}) {
  const [prefs, setPrefs] = useState(initial);

  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((option) => (
        <label
          key={option.key}
          className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-surface-muted"
        >
          <div>
            <p className="text-sm font-medium text-foreground">{option.label}</p>
            <p className="text-xs text-foreground-muted">{option.description}</p>
          </div>
          <input
            type="checkbox"
            checked={prefs[option.key]}
            onChange={() =>
              setPrefs((prev) => ({ ...prev, [option.key]: !prev[option.key] }))
            }
            className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
          />
        </label>
      ))}
    </div>
  );
}
