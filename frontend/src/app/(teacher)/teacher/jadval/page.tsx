"use client";

/**
 * Ustozning dars jadvali (ADM-08, MET-09).
 *
 * Maʼlumot serverdan: `/api/v1/attendance/my-lessons/range`. Bu «mening
 * darslarim» — kesim server tomonida, ustoz boshqa birovning jadvalini
 * koʻra olmaydi (CLAUDE.md 7-qoida).
 *
 * Uch koʻrinish: oy / hafta / kun. Kalendar kutubxonasiz — bundle
 * yengil qolsin (NFR-01: 4G da 2,5 soniyadan tez).
 *
 * Sana hisobi mahalliy (Asia/Tashkent): `lesson.date` allaqachon
 * `attendance-api.ts` da UTC dan oʻgirilgan (CLAUDE.md 3-qoida).
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CalendarIcon, CheckIcon } from "@/components/ui/icons";
import { getLessonsInRange, localToday } from "@/lib/teacher/attendance-api";
import type { TeacherLesson } from "@/lib/teacher/types";

type View = "month" | "week" | "day";

const MONTHS_UZ = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const WEEKDAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const WEEKDAY_LONG = [
  "dushanba",
  "seshanba",
  "chorshanba",
  "payshanba",
  "juma",
  "shanba",
  "yakshanba",
];

/**
 * Sinf rangi — nomdan barqaror hisoblanadi.
 *
 * Serverdan rang kelmaydi va kelishi ham shart emas: bu koʻrinish
 * masalasi. Bir xil nom har doim bir xil rang beradi, shunda jadval
 * yangilanganda ranglar sakramaydi.
 */
const CLASS_TONES = [
  "border-l-brand",
  "border-l-info",
  "border-l-warning",
  "border-l-success",
  "border-l-danger",
];

function classTone(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return CLASS_TONES[sum % CLASS_TONES.length];
}

// ─────────────────────────── Sana yordamchilari ───────────────────────────

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

/** 1 = dushanba … 7 = yakshanba. `Date.getDay()` yakshanbani 0 qiladi. */
function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

function weekStart(d: Date): Date {
  return addDays(d, -(isoWeekday(d) - 1));
}

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}, ${WEEKDAY_LONG[isoWeekday(d) - 1]}`;
}

// ─────────────────────────── Sahifa ───────────────────────────

export default function TeacherSchedulePage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date(`${localToday()}T00:00:00`));
  const [classFilter, setClassFilter] = useState("all");

  const [lessons, setLessons] = useState<TeacherLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = localToday();

  /**
   * Koʻrinishga qarab sana oraligʻi.
   *
   * Oy koʻrinishida grid toʻliq haftalardan iborat, shuning uchun
   * chegaralar oy emas, hafta boʻyicha kengaytiriladi.
   */
  const { from, to } = useMemo(() => {
    if (view === "day") return { from: iso(anchor), to: iso(anchor) };
    if (view === "week") {
      const start = weekStart(anchor);
      return { from: iso(start), to: iso(addDays(start, 6)) };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: iso(weekStart(first)), to: iso(addDays(weekStart(last), 6)) };
  }, [view, anchor]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getLessonsInRange(from, to)
      .then((rows) => alive && setLessons(rows))
      .catch(() => alive && setError("Jadvalni olib boʻlmadi."))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [from, to]);

  const classes = useMemo(
    () => [...new Set(lessons.map((l) => l.className))].sort(),
    [lessons],
  );

  const visible = useMemo(
    () => (classFilter === "all" ? lessons : lessons.filter((l) => l.className === classFilter)),
    [lessons, classFilter],
  );

  /** Sana → darslar. Har katak uchun butun roʻyxatni filtrlamaslik uchun. */
  const byDate = useMemo(() => {
    const map = new Map<string, TeacherLesson[]>();
    for (const l of visible) {
      const bor = map.get(l.date);
      if (bor) bor.push(l);
      else map.set(l.date, [l]);
    }
    for (const rows of map.values()) rows.sort((a, b) => a.period - b.period);
    return map;
  }, [visible]);

  const weeklyHours = visible.length;

  function shift(step: number) {
    if (view === "day") setAnchor((d) => addDays(d, step));
    else if (view === "week") setAnchor((d) => addDays(d, step * 7));
    else setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + step, 1));
  }

  const title =
    view === "day"
      ? dayLabel(iso(anchor))
      : view === "week"
        ? `${new Date(`${from}T00:00:00`).getDate()}–${new Date(`${to}T00:00:00`).getDate()}-${
            MONTHS_UZ[new Date(`${to}T00:00:00`).getMonth()]
          }`
        : `${MONTHS_UZ[anchor.getMonth()]} ${anchor.getFullYear()}`;

  return (
    <TeacherShell
      title="Dars jadvali"
      subtitle={
        loading
          ? "Yuklanmoqda…"
          : `Koʻrsatilgan oraliqda ${weeklyHours} ta dars`
      }
    >
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Oldingi"
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:bg-surface-muted"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Keyingi"
            className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:bg-surface-muted"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date(`${today}T00:00:00`))}
            className="focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted"
          >
            Bugun
          </button>
          <h2 className="ml-1 text-base font-semibold text-foreground">{title}</h2>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {classes.length > 1 && (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                aria-label="Sinf boʻyicha filtr"
                className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
              >
                <option value="all">Barcha sinflar</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <div role="tablist" aria-label="Koʻrinish" className="flex rounded-lg border border-border">
              {(["month", "week", "day"] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`focus-ring h-9 px-3 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                    view === v
                      ? "bg-brand text-brand-foreground"
                      : "text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {v === "month" ? "Oy" : v === "week" ? "Hafta" : "Kun"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <ListSkeleton count={5} />
        ) : error ? (
          <ErrorState description={error} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-5 w-5" />}
            title="Bu oraliqda dars yoʻq"
            description="Jadval administrator tomonidan tuziladi. Agar dars boʻlishi kerak boʻlsa, oʻquv boʻlimiga murojaat qiling."
          />
        ) : view === "day" ? (
          <DayList lessons={byDate.get(iso(anchor)) ?? []} />
        ) : (
          <Grid from={from} to={to} byDate={byDate} today={today} compact={view === "month"} />
        )}
      </div>
    </TeacherShell>
  );
}

// ─────────────────────────── Kun roʻyxati ───────────────────────────

function DayList({ lessons }: { lessons: TeacherLesson[] }) {
  if (lessons.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon className="h-5 w-5" />}
        title="Bu kuni dars yoʻq"
        description="Dam oling yoki metodik bazaga kirib rejalarni koʻrib chiqing."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {lessons.map((lesson) => (
        <li
          key={lesson.id}
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 border-border bg-surface p-4 shadow-sm ${classTone(
            lesson.className,
          )}`}
        >
          <div>
            <p className="text-base font-semibold text-foreground">
              {lesson.subject} · {lesson.className}
            </p>
            <p className="num text-sm text-foreground-muted">
              {lesson.period}-para · {lesson.startTime}–{lesson.endTime}
              {lesson.room ? ` · ${lesson.room}-xona` : ""}
            </p>
            {lesson.topic ? (
              <p className="mt-0.5 text-sm text-foreground-muted">Mavzu: {lesson.topic}</p>
            ) : null}
          </div>

          {lesson.presentCount === null ? (
            <Link
              href={`/teacher/davomat/${lesson.id}`}
              className="focus-ring inline-flex h-10 shrink-0 items-center rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
            >
              Davomat belgilash
            </Link>
          ) : (
            <Link
              href={`/teacher/davomat/${lesson.id}`}
              className="focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-success/40 bg-success-tint px-3.5 text-sm font-semibold text-success transition-colors"
            >
              <CheckIcon className="h-4 w-4" />
              <span className="num">
                {lesson.presentCount}/{lesson.studentCount}
              </span>{" "}
              belgilangan
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────── Hafta / oy gridi ───────────────────────────

function Grid({
  from,
  to,
  byDate,
  today,
  compact,
}: {
  from: string;
  to: string;
  byDate: Map<string, TeacherLesson[]>;
  today: string;
  compact: boolean;
}) {
  const days: string[] = [];
  for (
    let d = new Date(`${from}T00:00:00`);
    iso(d) <= to;
    d = addDays(d, 1)
  ) {
    days.push(iso(d));
  }

  return (
    <div className="scroll-x">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-7 gap-1.5 pb-1.5">
          {WEEKDAY_SHORT.map((w) => (
            <div
              key={w}
              className="text-center text-xs font-medium uppercase tracking-wide text-foreground-muted"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const rows = byDate.get(day) ?? [];
            const bugun = day === today;
            const kun = new Date(`${day}T00:00:00`).getDate();
            return (
              <div
                key={day}
                className={`rounded-lg border p-1.5 ${
                  bugun ? "border-brand bg-brand-tint/40" : "border-border bg-surface"
                } ${compact ? "min-h-[5.5rem]" : "min-h-[9rem]"}`}
              >
                <p
                  className={`num mb-1 text-xs font-semibold ${
                    bugun ? "text-brand-dark" : "text-foreground-muted"
                  }`}
                >
                  {kun}
                </p>
                <ul className="flex flex-col gap-1">
                  {rows.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/teacher/davomat/${lesson.id}`}
                        className={`focus-ring block rounded border-l-2 bg-surface-muted px-1.5 py-1 transition-colors hover:bg-surface-muted/70 ${classTone(
                          lesson.className,
                        )}`}
                      >
                        <span className="block truncate text-xs font-medium text-foreground">
                          {lesson.className}
                        </span>
                        <span className="block truncate text-xs text-foreground-muted">
                          {compact ? lesson.subject : `${lesson.startTime} ${lesson.subject}`}
                        </span>
                        {lesson.presentCount !== null && (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-success">
                            <CheckIcon className="h-3 w-3" />
                            belgilangan
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
