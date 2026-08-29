"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DEMO_HOMEWORK } from "@/lib/teacher/data";
import { studentStats } from "@/lib/teacher/store";
import type { TeacherLesson } from "@/lib/teacher/types";

/**
 * Ustozning ish stoli — "hozir nima qilishim kerak?" degan savolga
 * bitta joyda javob.
 *
 * Bunday boʻlmasa ustoz har kuni toʻrtta boʻlimga kirib chiqib, nima
 * qolganini oʻzi hisoblab yuradi. Bu yerda faqat AMAL talab qiladigan
 * narsalar koʻrsatiladi — sof statistika emas.
 */

const HOMEROOM_CLASS = "11-A";

export function TodaySummary({ lessons }: { lessons: TeacherLesson[] | null }) {
  const [atRisk, setAtRisk] = useState<number | null>(null);

  useEffect(() => {
    // localStorage faqat brauzerda.
    const stats = studentStats(HOMEROOM_CLASS);
    setAtRisk(stats.filter((s) => s.total > 0 && s.percent < 80).length);
  }, [lessons]);

  const unmarked = lessons?.filter((l) => l.presentCount === null && l.editable) ?? [];
  const ungraded = DEMO_HOMEWORK.reduce(
    (sum, h) => sum + (h.submittedCount - h.gradedCount),
    0,
  );

  const items: {
    key: string;
    count: number;
    label: string;
    href: string;
    tone: "warning" | "danger" | "brand";
  }[] = [];

  if (unmarked.length > 0) {
    items.push({
      key: "attendance",
      count: unmarked.length,
      label: unmarked.length === 1 ? "darsga davomat belgilanmagan" : "ta darsga davomat belgilanmagan",
      href: `/teacher/davomat/${unmarked[0].id}`,
      tone: "warning",
    });
  }
  if (ungraded > 0) {
    items.push({
      key: "homework",
      count: ungraded,
      label: "ta ish tekshirilmagan",
      href: "/teacher/vazifa",
      tone: "brand",
    });
  }
  if (atRisk !== null && atRisk > 0) {
    items.push({
      key: "risk",
      count: atRisk,
      label: "ta oʻquvchi davomati 80% dan past",
      href: "/teacher/jurnal",
      tone: "danger",
    });
  }

  if (lessons === null) {
    return <div className="mb-5 h-20 animate-pulse rounded-xl border border-border bg-surface" />;
  }

  if (items.length === 0) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-success/30 bg-success-tint px-4 py-3.5">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-brand-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l6 6L20 6" />
          </svg>
        </span>
        <p className="text-sm font-medium text-success">
          Hammasi joyida — kutilayotgan ish yoʻq.
        </p>
      </div>
    );
  }

  const tone = {
    warning: "border-warning/30 bg-warning-tint text-warning",
    danger: "border-danger/30 bg-danger-tint text-danger",
    brand: "border-brand/30 bg-brand-tint text-brand-dark",
  };

  return (
    <section aria-label="Kutilayotgan ishlar" className="mb-5">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={`flex h-full items-center gap-3 rounded-xl border px-4 py-3.5 transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${tone[item.tone]}`}
            >
              <span className="text-2xl font-bold tabular-nums">{item.count}</span>
              <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                {item.label}
              </span>
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 opacity-60"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
