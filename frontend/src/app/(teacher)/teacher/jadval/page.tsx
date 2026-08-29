"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { LessonPlanPanel } from "@/components/teacher/LessonPlanPanel";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { DEMO_LESSONS } from "@/lib/teacher/data";
import {
  ALL_CLASSES,
  BELL_SCHEDULE,
  buildLessons,
  classColor,
  formatDayLabel,
  HOLIDAY_TITLES,
  isHoliday,
  isoWeekday,
  MONTHS_UZ,
  TODAY,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type ScheduleLesson,
} from "@/lib/teacher/schedule";

/**
 * Umumiy dars jadvali (ADM-08, MET-09).
 *
 * Uch koʻrinish: oy / hafta / kun. Har bir sinf oʻz rangida.
 * Kalendar kutubxonasiz yozilgan — bundle yengil qolsin (NFR-01: 4G da
 * 2,5 soniyadan tez).
 */

type View = "month" | "week" | "day";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Haftaning dushanbasi. */
function weekStart(d: Date): Date {
  return addDays(d, -(isoWeekday(d) - 1));
}

export default function SchedulePage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(new Date(`${TODAY}T00:00:00`));
  const [classFilter, setClassFilter] = useState<string>("all");
  // Jadvalda bosilgan dars — pastda uning rejasi ochiladi.
  const [picked, setPicked] = useState<ScheduleLesson | null>(null);

  // Koʻrinishga qarab sana oraligʻi.
  const { from, to } = useMemo(() => {
    if (view === "day") return { from: anchor, to: anchor };
    if (view === "week") {
      const start = weekStart(anchor);
      return { from: start, to: addDays(start, 6) };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: addDays(first, -(isoWeekday(first) - 1)), to: addDays(last, 7 - isoWeekday(last)) };
  }, [anchor, view]);

  const lessons = useMemo(() => {
    const all = buildLessons(from, to);
    return classFilter === "all" ? all : all.filter((l) => l.className === classFilter);
  }, [from, to, classFilter]);

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleLesson[]>();
    for (const lesson of lessons) {
      const list = map.get(lesson.date) ?? [];
      list.push(lesson);
      map.set(lesson.date, list);
    }
    return map;
  }, [lessons]);

  function shift(direction: -1 | 1) {
    if (view === "day") setAnchor((d) => addDays(d, direction));
    else if (view === "week") setAnchor((d) => addDays(d, direction * 7));
    else setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
  }

  const title =
    view === "day"
      ? formatDayLabel(iso(anchor))
      : view === "week"
        ? `${from.getDate()}–${to.getDate()} ${MONTHS_UZ[to.getMonth()]} ${to.getFullYear()}`
        : `${MONTHS_UZ[anchor.getMonth()]} ${anchor.getFullYear()}`;

  return (
    <TeacherShell
      title="Dars jadvali"
      subtitle={`Haftalik yuklama: ${buildLessons(weekStart(new Date(`${TODAY}T00:00:00`)), addDays(weekStart(new Date(`${TODAY}T00:00:00`)), 6)).length} soat`}
    >
      {/* --- Boshqaruv paneli --- */}
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
            onClick={() => setAnchor(new Date(`${TODAY}T00:00:00`))}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Bugun
          </button>
          <p className="ml-1 text-base font-semibold">{title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="Sinf boʻyicha filtr"
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <option value="all">Barcha sinflar</option>
            {ALL_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div role="tablist" aria-label="Koʻrinish" className="flex rounded-lg border border-border bg-surface p-0.5">
            {(
              [
                ["month", "Oy"],
                ["week", "Hafta"],
                ["day", "Kun"],
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
      </div>

      {view === "month" && <MonthView from={from} to={to} byDate={byDate} onPick={setPicked} />}
      {view === "week" && <WeekView from={from} byDate={byDate} onPick={setPicked} />}
      {view === "day" && (
        <DayView
          date={iso(anchor)}
          lessons={byDate.get(iso(anchor)) ?? []}
          onPick={setPicked}
        />
      )}

      {/* Tanlangan darsning rejasi — faqat shu darsning fani boʻyicha */}
      {picked && <LessonPlanPanel lesson={picked} onClose={() => setPicked(null)} />}

      {/* --- Izoh (legend) --- */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <span className="font-medium text-foreground-muted">Izoh:</span>
        {ALL_CLASSES.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={`h-3 w-3 rounded-sm ${classColor(c).dot}`} />
            {c}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-foreground-muted">
          <span aria-hidden className="h-3 w-3 rounded-sm border border-border bg-surface-muted" />
          Taʼtil
        </span>
      </div>
    </TeacherShell>
  );
}

/* ---------------- Oy koʻrinishi ---------------- */

function MonthView({
  from,
  to,
  byDate,
  onPick,
}: {
  from: Date;
  to: Date;
  byDate: Map<string, ScheduleLesson[]>;
  onPick: (lesson: ScheduleLesson) => void;
}) {
  const days: Date[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) days.push(new Date(d));

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted/60">
          {WEEKDAY_SHORT.map((w) => (
            <div key={w} className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const date = iso(day);
            const items = byDate.get(date) ?? [];
            const isToday = date === TODAY;
            const holiday = isHoliday(date);

            return (
              <div
                key={date}
                className={`min-h-[104px] border-b border-r border-border p-1.5 last:border-r-0 ${
                  holiday ? "bg-surface-muted/50" : ""
                } ${isToday ? "bg-brand-tint/40" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium ${
                      isToday
                        ? "bg-brand text-brand-foreground"
                        : "text-foreground-muted"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {holiday && (
                    <span className="truncate text-[10px] text-foreground-muted">
                      {HOLIDAY_TITLES[date]}
                    </span>
                  )}
                </div>

                <ul className="space-y-0.5">
                  {items.slice(0, 3).map((lesson) => (
                    <li key={lesson.id}>
                      <LessonChip lesson={lesson} onPick={onPick} compact />
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

/* ---------------- Hafta koʻrinishi ---------------- */

function WeekView({
  from,
  byDate,
  onPick,
}: {
  from: Date;
  byDate: Map<string, ScheduleLesson[]>;
  onPick: (lesson: ScheduleLesson) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const periods = Object.keys(BELL_SCHEDULE).map(Number).sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <caption className="sr-only">Haftalik dars jadvali</caption>
        <thead>
          <tr className="border-b border-border bg-surface-muted/60">
            <th scope="col" className="w-24 px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Para
            </th>
            {days.map((day) => {
              const date = iso(day);
              const isToday = date === TODAY;
              return (
                <th
                  key={date}
                  scope="col"
                  className={`px-2 py-2 text-center text-xs font-medium ${
                    isToday ? "text-brand-dark" : "text-foreground-muted"
                  }`}
                >
                  <span className="block uppercase tracking-wide">
                    {WEEKDAY_SHORT[isoWeekday(day) - 1]}
                  </span>
                  <span className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm ${
                    isToday ? "bg-brand text-brand-foreground" : "text-foreground"
                  }`}>
                    {day.getDate()}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period} className="border-b border-border last:border-0">
              <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left align-top">
                <span className="block text-sm font-medium">{period}-para</span>
                <span className="block text-[11px] font-normal text-foreground-muted">
                  {BELL_SCHEDULE[period].start}–{BELL_SCHEDULE[period].end}
                </span>
              </th>
              {days.map((day) => {
                const date = iso(day);
                const lesson = (byDate.get(date) ?? []).find((l) => l.period === period);
                return (
                  <td
                    key={date}
                    className={`border-l border-border p-1 align-top ${
                      isHoliday(date) ? "bg-surface-muted/50" : ""
                    }`}
                  >
                    {lesson ? <LessonChip lesson={lesson} onPick={onPick} /> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Kun koʻrinishi ---------------- */

function DayView({
  date,
  lessons,
  onPick,
}: {
  date: string;
  lessons: ScheduleLesson[];
  onPick: (lesson: ScheduleLesson) => void;
}) {
  if (isHoliday(date)) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
        <p className="text-base font-medium">{HOLIDAY_TITLES[date]}</p>
        <p className="mt-1 text-sm text-foreground-muted">Taʼtil kuni — dars yoʻq.</p>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
        <p className="text-base font-medium">Bu kuni darsingiz yoʻq</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {lessons.map((lesson) => {
        const color = classColor(lesson.className);
        return (
          <li
            key={lesson.id}
            className="flex items-stretch gap-3 overflow-hidden rounded-xl border border-border bg-surface"
          >
            <span aria-hidden className={`w-1.5 shrink-0 ${color.dot}`} />
            <div className="flex flex-1 flex-wrap items-center justify-between gap-3 py-3 pr-4">
              <button
                type="button"
                onClick={() => onPick(lesson)}
                className="min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="block font-medium">
                  {lesson.subject} · {lesson.className}
                </span>
                <span className="mt-0.5 block text-sm text-foreground-muted">
                  {lesson.period}-para · {lesson.startTime}–{lesson.endTime} · {lesson.room}
                </span>
                <span className="mt-0.5 block text-xs text-brand-dark">
                  Rejasini koʻrish →
                </span>
              </button>
              <TodayAction lesson={lesson} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Umumiy ---------------- */

function LessonChip({
  lesson,
  onPick,
  compact,
}: {
  lesson: ScheduleLesson;
  onPick: (lesson: ScheduleLesson) => void;
  compact?: boolean;
}) {
  const color = classColor(lesson.className);
  const label = `${lesson.className} ${lesson.subject}, ${lesson.startTime}–${lesson.endTime}, ${lesson.room}. Rejasini koʻrish`;

  return (
    <button
      type="button"
      onClick={() => onPick(lesson)}
      title={label}
      aria-label={label}
      className={`block w-full rounded px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${color.block}`}
    >
      <span className="block truncate font-semibold">
        {lesson.className} · {lesson.subject}
      </span>
      {!compact && (
        <span className="mt-0.5 block truncate opacity-90">
          {lesson.startTime}–{lesson.endTime}
        </span>
      )}
      <span className="block truncate opacity-90">{lesson.room}</span>
    </button>
  );
}

/** Bugungi dars boʻlsa — davomatga toʻgʻridan-toʻgʻri oʻtish. */
function TodayAction({ lesson }: { lesson: ScheduleLesson }) {
  if (lesson.date !== TODAY) return null;
  const match = DEMO_LESSONS.find(
    (l) => l.period === lesson.period && l.className === lesson.className,
  );
  if (!match) return null;

  return (
    <Link
      href={`/teacher/davomat/${match.id}`}
      className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      Davomat belgilash
    </Link>
  );
}
