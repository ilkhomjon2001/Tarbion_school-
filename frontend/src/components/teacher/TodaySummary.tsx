"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchHomework } from "@/lib/teacher/journal-api";
import type { TeacherLesson } from "@/lib/teacher/types";

/**
 * Ustozning ish stoli — "hozir nima qilishim kerak?" degan savolga
 * bitta joyda javob.
 *
 * Bunday boʻlmasa ustoz har kuni toʻrtta boʻlimga kirib chiqib, nima
 * qolganini oʻzi hisoblab yuradi. Bu yerda faqat AMAL talab qiladigan
 * narsalar koʻrsatiladi — sof statistika emas.
 *
 * Hisoblar SERVERDAN: tekshirilmagan ishlar soni ustozning real uy
 * vazifalari roʻyxatidan (`/api/v1/journal/homework`) chiqariladi —
 * demo raqam emas.
 */

type HomeworkState =
  | { status: "loading" }
  | { status: "ready"; ungraded: number }
  | { status: "error" };

export function TodaySummary({ lessons }: { lessons: TeacherLesson[] | null }) {
  const [homework, setHomework] = useState<HomeworkState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    fetchHomework()
      .then((items) => {
        if (!alive) return;
        const ungraded = items.reduce(
          (sum, h) => sum + Math.max(0, h.submitted_count - h.graded_count),
          0,
        );
        setHomework({ status: "ready", ungraded });
      })
      .catch(() => alive && setHomework({ status: "error" }));
    return () => {
      alive = false;
    };
  }, []);

  const unmarked = lessons?.filter((l) => l.presentCount === null && l.editable) ?? [];

  const items: {
    key: string;
    count: number;
    label: string;
    href: string;
    tone: "warning" | "brand";
  }[] = [];

  if (unmarked.length > 0) {
    items.push({
      key: "attendance",
      count: unmarked.length,
      label:
        unmarked.length === 1
          ? "darsga davomat belgilanmagan"
          : "ta darsga davomat belgilanmagan",
      href: `/teacher/davomat/${unmarked[0].id}`,
      tone: "warning",
    });
  }
  if (homework.status === "ready" && homework.ungraded > 0) {
    items.push({
      key: "homework",
      count: homework.ungraded,
      label: "ta ish tekshirilmagan",
      href: "/teacher/vazifa",
      tone: "brand",
    });
  }

  if (lessons === null || homework.status === "loading") {
    return <div className="mb-5 h-20 animate-pulse rounded-xl border border-border bg-surface" />;
  }

  if (items.length === 0) {
    // Hisob kelmagan boʻlsa "hammasi joyida" deyish yolgʻon boʻlardi —
    // faqat ogohlantirish qoladi.
    if (homework.status === "error") {
      return (
        <div className="mb-5">
          <HomeworkErrorNote />
        </div>
      );
    }
    return (
      <div className="mb-5">
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-tint px-4 py-3.5">
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
      </div>
    );
  }

  const tone = {
    warning: "border-warning/30 bg-warning-tint text-warning",
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
              <span className="text-2xl font-bold num">{item.count}</span>
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
      {homework.status === "error" && <HomeworkErrorNote />}
    </section>
  );
}

/** Uy vazifasi hisobi kelmasa — jim yutib yubormaymiz, soxta "0" ham
 *  koʻrsatmaymiz. */
function HomeworkErrorNote() {
  return (
    <p className="mt-2 text-xs text-foreground-muted">
      Uy vazifasi hisobini olib boʻlmadi —{" "}
      <Link
        href="/teacher/vazifa"
        className="underline underline-offset-2 hover:text-foreground"
      >
        roʻyxatni oching
      </Link>
      .
    </p>
  );
}
