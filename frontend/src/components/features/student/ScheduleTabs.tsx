"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LessonRow } from "@/components/features/student/LessonRow";
import { WEEKDAY_LABELS } from "@/lib/format";
import { subjectColor } from "@/lib/subject-colors";
import type { ScheduleEntry } from "@/lib/types";

const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const MONTHS_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const TODAY_ISO = "2026-08-29";

type View = "day" | "week" | "month";

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** 1 = dushanba ... 7 = yakshanba. */
function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

function weekStart(d: Date): Date {
  return addDays(d, -(isoWeekday(d) - 1));
}

export function ScheduleTabs({ entries }: { entries: ScheduleEntry[] }) {
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState<Date>(new Date(`${TODAY_ISO}T00:00:00`));

  const byWeekday = useMemo(() => {
    const map = new Map<number, ScheduleEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.dayOfWeek) ?? [];
      list.push(entry);
      map.set(entry.dayOfWeek, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.periodNumber - b.periodNumber);
    }
    return map;
  }, [entries]);

  const periods = useMemo(() => {
    const byPeriod = new Map<number, ScheduleEntry>();
    for (const entry of entries) {
      if (!byPeriod.has(entry.periodNumber)) byPeriod.set(entry.periodNumber, entry);
    }
    return [...byPeriod.entries()]
      .sort(([a], [b]) => a - b)
      .map(([periodNumber, ref]) => ({
        periodNumber,
        startTime: ref.startTime,
        endTime: ref.endTime,
      }));
  }, [entries]);

  function shift(direction: -1 | 1) {
    if (view === "day") setAnchor((d) => addDays(d, direction));
    else if (view === "week") setAnchor((d) => addDays(d, direction * 7));
    else setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
  }

  const weekFrom = weekStart(anchor);
  const monthFirst = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthLast = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const monthFrom = addDays(monthFirst, -(isoWeekday(monthFirst) - 1));
  const monthTo = addDays(monthLast, 7 - isoWeekday(monthLast));

  const subjects = useMemo(
    () => [...new Set(entries.map((e) => e.subject))].sort(),
    [entries],
  );

  const title =
    view === "day"
      ? `${WEEKDAY_LABELS[isoWeekday(anchor) - 1]}, ${anchor.getDate()}-${MONTHS_UZ[anchor.getMonth()]}`
      : view === "week"
        ? `${weekFrom.getDate()}–${addDays(weekFrom, 6).getDate()} ${MONTHS_UZ[addDays(weekFrom, 6).getMonth()]} ${addDays(weekFrom, 6).getFullYear()}`
        : `${MONTHS_UZ[anchor.getMonth()]} ${anchor.getFullYear()}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Oldingi"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Keyingi"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date(`${TODAY_ISO}T00:00:00`))}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Bugun
          </button>
        </div>

        <div role="tablist" aria-label="Koʻrinish" className="flex rounded-lg border border-border bg-surface p-0.5">
          {(
            [
              ["day", "Kun"],
              ["week", "Hafta"],
              ["month", "Oy"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`h-8 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                view === key
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-sm font-medium text-foreground-muted">{title}</p>

      {view === "day" && <DayView entries={byWeekday.get(isoWeekday(anchor)) ?? []} />}
      {view === "week" && <WeekView from={weekFrom} byWeekday={byWeekday} periods={periods} />}
      {view === "month" && (
        <MonthView from={monthFrom} to={monthTo} monthIndex={anchor.getMonth()} byWeekday={byWeekday} />
      )}

      {view !== "day" && subjects.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium text-foreground-muted">Izoh:</span>
          {subjects.map((subject) => (
            <span key={subject} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={`h-3 w-3 rounded-sm ${subjectColor(subject).dot}`} />
              {subject}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DayView({ entries }: { entries: ScheduleEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="Bu kuni dars yoʻq" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <LessonRow key={entry.id} lesson={entry} />
      ))}
    </div>
  );
}

function WeekView({
  from,
  byWeekday,
  periods,
}: {
  from: Date;
  byWeekday: Map<number, ScheduleEntry[]>;
  periods: { periodNumber: number; startTime: string; endTime: string }[];
}) {
  const activeWeekdays = useMemo(
    () => [...byWeekday.keys()].sort((a, b) => a - b),
    [byWeekday],
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i)).filter((day) =>
    activeWeekdays.includes(isoWeekday(day)),
  );

  if (periods.length === 0 || days.length === 0) {
    return <EmptyState title="Dars jadvali boʻsh" />;
  }

  const gridTemplateColumns = `5.5rem repeat(${days.length}, minmax(112px, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <div role="table" aria-label="Haftalik dars jadvali" className="min-w-fit">
        <div
          role="row"
          className="grid border-b border-border bg-surface-muted/60"
          style={{ gridTemplateColumns }}
        >
          <div
            role="columnheader"
            className="flex items-center px-3 py-3 text-xs font-medium uppercase tracking-wide text-foreground-muted"
          >
            Para
          </div>
          {days.map((day) => {
            const isToday = isoDate(day) === TODAY_ISO;
            return (
              <div
                key={isoDate(day)}
                role="columnheader"
                className={`flex flex-col items-center gap-1 py-3 ${
                  isToday ? "bg-brand-tint/50" : ""
                }`}
              >
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  {WEEKDAY_SHORT[isoWeekday(day) - 1]}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? "bg-brand text-brand-foreground" : "text-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {periods.map(({ periodNumber, startTime, endTime }, index) => (
          <div
            key={periodNumber}
            role="row"
            className={`grid ${index % 2 === 1 ? "bg-surface-muted/40" : ""}`}
            style={{ gridTemplateColumns }}
          >
            <div role="rowheader" className="px-3 py-3">
              <span className="block text-sm font-semibold text-foreground">
                {periodNumber}-para
              </span>
              <span className="block text-[11px] text-foreground-muted">
                {startTime}–{endTime}
              </span>
            </div>
            {days.map((day) => {
              const entry = (byWeekday.get(isoWeekday(day)) ?? []).find(
                (e) => e.periodNumber === periodNumber,
              );
              return (
                <div key={isoDate(day)} role="cell" className="p-1.5">
                  {entry ? (
                    <div className={`rounded-lg px-2.5 py-2 shadow-sm ${subjectColor(entry.subject).block}`}>
                      <p className="truncate text-xs font-semibold">{entry.subject}</p>
                      <p className="truncate text-[11px] opacity-90">
                        {entry.startTime}–{entry.endTime}
                      </p>
                      <p className="truncate text-[11px] opacity-90">{entry.room}-xona</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({
  from,
  to,
  monthIndex,
  byWeekday,
}: {
  from: Date;
  to: Date;
  monthIndex: number;
  byWeekday: Map<number, ScheduleEntry[]>;
}) {
  const days: Date[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) days.push(new Date(d));

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted/60">
          {WEEKDAY_SHORT.map((w) => (
            <div key={w} className="px-2 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {days.map((day) => {
            const date = isoDate(day);
            const isToday = date === TODAY_ISO;
            const isOtherMonth = day.getMonth() !== monthIndex;
            const items = byWeekday.get(isoWeekday(day)) ?? [];
            return (
              <div
                key={date}
                className={`min-h-[92px] p-1.5 ${isToday ? "bg-brand-tint/30" : ""} ${
                  isOtherMonth ? "opacity-40" : ""
                }`}
              >
                <span
                  className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium ${
                    isToday ? "bg-brand text-brand-foreground" : "text-foreground-muted"
                  }`}
                >
                  {day.getDate()}
                </span>
                <ul className="space-y-1">
                  {items.slice(0, 3).map((entry) => (
                    <li key={entry.id}>
                      <span
                        title={`${entry.subject}, ${entry.startTime}–${entry.endTime}`}
                        className={`block truncate rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight ${subjectColor(entry.subject).block}`}
                      >
                        {entry.subject}
                      </span>
                    </li>
                  ))}
                  {items.length > 3 && (
                    <li className="px-1 text-[11px] text-foreground-muted">
                      +{items.length - 3} ta koʻproq
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
