"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DEMO_LESSONS } from "@/lib/teacher/data";
import { hasPlan, planFor, type PlanPosition } from "@/lib/teacher/plan";
import { classColor, TODAY, type ScheduleLesson } from "@/lib/teacher/schedule";
import { conductedCount } from "@/lib/teacher/store";

/**
 * Jadvaldan tanlangan darsning rejasi.
 *
 * Ustoz jadvalda darsni bosadi — shu darsning mavzusi va kartochkasi
 * ochiladi. Reja FAQAT shu darsning fani boʻyicha koʻrsatiladi, butun
 * baza emas: ustoz oʻz fanidan boshqa narsani izlamaydi.
 */
export function LessonPlanPanel({
  lesson,
  onClose,
}: {
  lesson: ScheduleLesson;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<PlanPosition | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // conductedCount localStorage'ni oʻqiydi — faqat brauzerda.
    if (hasPlan(lesson.className)) {
      const done = conductedCount(lesson.className, lesson.subject, lesson.date);
      setPlan(planFor(lesson, done));
    } else {
      setPlan(null);
    }
    setReady(true);
  }, [lesson]);

  // Esc bilan yopish.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const color = classColor(lesson.className);
  const todayLesson =
    lesson.date === TODAY
      ? DEMO_LESSONS.find(
          (l) => l.period === lesson.period && l.className === lesson.className,
        )
      : undefined;

  return (
    <section
      aria-label="Dars rejasi"
      className="mt-4 overflow-hidden rounded-xl border border-brand/30 bg-surface"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-brand-tint/40 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color.block}`}
            >
              {lesson.className}
            </span>
            <span className="text-sm font-medium">{lesson.subject}</span>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            {lesson.date} · {lesson.period}-para · {lesson.startTime}–{lesson.endTime} ·{" "}
            {lesson.room}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {todayLesson && (
            <Link
              href={`/teacher/davomat/${todayLesson.id}`}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Davomat belgilash
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="p-4">
        {!ready ? (
          <p className="py-4 text-sm text-foreground-muted">Yuklanmoqda…</p>
        ) : !plan ? (
          <div className="py-4">
            <p className="text-sm font-medium">Bu fan uchun reja bazasi hali yoʻq</p>
            <p className="mt-1 text-sm text-foreground-muted">
              {lesson.subject} boʻyicha metodik baza tayyorlanmoqda. Mavzuni
              davomat belgilashda qoʻlda yozishingiz mumkin — tizim yozganingizga
              mos mavzularni taklif qiladi.
            </p>
          </div>
        ) : plan.overrun ? (
          <div className="py-4">
            <p className="text-sm font-medium text-warning">Chorak rejasi tugagan</p>
            <p className="mt-1 text-sm text-foreground-muted">
              {plan.termName} uchun rejalashtirilgan barcha darslar oʻtilgan.
              Qoʻshimcha dars mavzusini oʻzingiz yozasiz.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-foreground-muted">
                  Rejadagi mavzu
                </p>
                <p className="mt-1 font-semibold">{plan.title!.title}</p>
                {plan.title!.model && (
                  <p className="mt-0.5 text-sm text-foreground-muted">
                    Model / amaliyot: {plan.title!.model}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground-muted">
                {plan.termName} · {plan.human}-dars
              </span>
            </div>

            {plan.card ? (
              <div className="mt-4 border-t border-border pt-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  {plan.card.maqsad && <Block title="Maqsad" items={plan.card.maqsad} />}
                  {plan.card.resurslar && (
                    <Block title="Kerakli jihozlar" items={plan.card.resurslar} />
                  )}
                  {plan.card.lugat && <Block title="Lugʻat" items={plan.card.lugat} />}
                  {plan.card.softSkill && (
                    <Block title="Yumshoq koʻnikma" items={[plan.card.softSkill]} />
                  )}
                </div>
                {plan.card.nazariya && (
                  <Steps title="Nazariy qism" steps={plan.card.nazariya} />
                )}
                {plan.card.amaliy && <Steps title="Amaliy qism" steps={plan.card.amaliy} />}
                {plan.card.uyga && (
                  <Block
                    title="Uyga vazifa"
                    items={Array.isArray(plan.card.uyga) ? plan.card.uyga : [plan.card.uyga]}
                  />
                )}
              </div>
            ) : (
              <p className="mt-4 border-t border-border pt-4 text-sm text-foreground-muted">
                Bu dars uchun toʻliq kartochka hali tayyorlanmagan — mavzu nomi bor.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-muted" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Steps({
  title,
  steps,
}: {
  title: string;
  steps: { title: string; points: string[] }[];
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </p>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i}>
            <p className="text-sm font-medium">{step.title}</p>
            <ul className="mt-1 space-y-1 text-sm text-foreground-muted">
              {step.points.map((p, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-muted" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
