"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { subjectColor } from "@/lib/subject-colors";
import { PERIOD_TIMES, PERIODS, WEEKDAYS } from "@/lib/director/types";
import type { TeacherWeeklyLesson } from "@/lib/director/data";
import type { SchoolClass, TeacherStats, Weekday } from "@/lib/director/types";

type Tab = "jadval" | "sinflar" | "statistika";

const TABS: { id: Tab; label: string }[] = [
  { id: "jadval", label: "Dars jadvali" },
  { id: "sinflar", label: "Sinflari" },
  { id: "statistika", label: "Statistika" },
];

export function TeacherProfileTabs({
  weeklySchedule,
  classes,
  stats,
}: {
  weeklySchedule: Record<Weekday, Record<number, TeacherWeeklyLesson | null>>;
  classes: SchoolClass[];
  stats: TeacherStats;
}) {
  const [tab, setTab] = useState<Tab>("statistika");

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-brand text-brand-dark"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "statistika" && <StatsTab stats={stats} />}
      {tab === "sinflar" && <ClassesTab classes={classes} />}
      {tab === "jadval" && <ScheduleTab weeklySchedule={weeklySchedule} />}
    </div>
  );
}

function StatsTab({ stats }: { stats: TeacherStats }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-foreground-muted">Oʻrtacha baho</p>
          <p className="mt-1 text-2xl font-bold text-brand-dark num">{stats.averageGradeGiven || "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">Davomat belgilash</p>
          <p className="mt-1 text-2xl font-bold text-foreground num">{stats.attendanceMarkingRate}%</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">Oʻtilgan darslar</p>
          <p className="mt-1 text-2xl font-bold text-foreground num">{stats.lessonsConducted}</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-foreground">Bugungi darslar</h3>
        {stats.todayLessons.length === 0 ? (
          <EmptyState title="Bugun darsi yoʻq" />
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.todayLessons.map((lesson, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                    {lesson.startTime}
                  </span>
                  <span className="font-medium text-foreground">{lesson.className} sinf</span>
                </div>
                <span className="text-foreground-muted">{lesson.subject}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ClassesTab({ classes }: { classes: SchoolClass[] }) {
  if (classes.length === 0) {
    return <EmptyState title="Sinflar topilmadi" description="Bu ustoz hozircha jadvalga biriktirilmagan." />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {classes.map((cls) => (
        <Card key={cls.id}>
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-foreground">{cls.name} sinf</p>
            <span className="text-xs text-foreground-muted">{cls.studentCount} oʻquvchi</span>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            Sinf rahbari: {cls.homeroomTeacherName}
          </p>
          <Link
            href="/rahbar/sinflar"
            className="mt-2 inline-block text-xs text-brand-dark underline-offset-2 hover:underline"
          >
            Roʻyxatni koʻrish
          </Link>
        </Card>
      ))}
    </div>
  );
}

function ScheduleTab({
  weeklySchedule,
}: {
  weeklySchedule: Record<Weekday, Record<number, TeacherWeeklyLesson | null>>;
}) {
  const hasAny = WEEKDAYS.some((day) => PERIODS.some((p) => weeklySchedule[day]?.[p]));
  if (!hasAny) {
    return <EmptyState title="Jadval boʻsh" description="Bu ustoz hali dars jadvaliga qoʻyilmagan." />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
            <th className="px-3 py-2.5">Para</th>
            {WEEKDAYS.map((day) => (
              <th key={day} className="px-3 py-2.5">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5 text-xs text-foreground-muted">
                {period}
                <div>{PERIOD_TIMES[period]}</div>
              </td>
              {WEEKDAYS.map((day) => {
                const lesson = weeklySchedule[day]?.[period];
                if (!lesson) {
                  return <td key={day} className="px-3 py-2.5 text-foreground-muted/40">—</td>;
                }
                const color = subjectColor(lesson.subject);
                return (
                  <td key={day} className="px-2 py-1.5">
                    <div className={`rounded-lg px-2.5 py-1.5 text-xs ${color.block}`}>
                      <p className="font-medium">{lesson.subject}</p>
                      <p className="opacity-90">{lesson.className} · {lesson.room}</p>
                    </div>
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
