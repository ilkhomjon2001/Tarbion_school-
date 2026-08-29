"use client";

import { useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { completedCount, planFor, termPlan, programYear } from "@/lib/teacher/plan";
import type { PlanCard } from "@/lib/teacher/plan-data";
import { PLAN_CARDS } from "@/lib/teacher/plan-data";
import { buildLessons, classColor, TODAY } from "@/lib/teacher/schedule";
import { ACADEMIC_YEAR, termForDate, termProgress, termWeek } from "@/lib/teacher/terms";

/**
 * Dars rejasi (MET-01, MET-02, MET-09).
 *
 * Ustoz bugun qaysi fandan nima oʻtishini va butun chorak rejasining
 * qayerida turganini koʻradi. Reja Tarbion Dars Rejalar Bazasidan olingan.
 */

const PLAN_CLASSES = ["7-A", "6-B"] as const;

export default function PlanPage() {
  const today = TODAY;
  const term = termForDate(today);

  const [selected, setSelected] = useState<string>("7-A");
  const [openCard, setOpenCard] = useState<number | null>(null);

  // Bugungi darslar orasidan rejasi bor boʻlganlari.
  const todayPlans = useMemo(() => {
    const day = new Date(`${today}T00:00:00`);
    return buildLessons(day, day)
      .map((lesson) => ({ lesson, plan: planFor(lesson) }))
      .filter((x) => x.plan !== null);
  }, [today]);

  const titles = termPlan(selected);
  const done = completedCount(selected, "Robototexnika", today);

  if (!term) {
    return (
      <TeacherShell title="Dars rejasi">
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="text-base font-medium">Bugun chorak davom etmayapti</p>
          <p className="mt-1 text-sm text-foreground-muted">Taʼtil kuni yoki oʻquv yilidan tashqari sana.</p>
        </div>
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      title="Dars rejasi"
      subtitle={`${ACADEMIC_YEAR} · ${term.name} · ${termWeek(term, today)}-hafta`}
    >
      {/* --- Chorak holati --- */}
      <div className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{term.name}</p>
          <p className="text-sm text-foreground-muted">
            {term.startsOn} – {term.endsOn} · {termProgress(term, today)}% oʻtdi
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={termProgress(term, today)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Chorak qanchasi oʻtgani"
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${termProgress(term, today)}%` }}
          />
        </div>
      </div>

      {/* --- Bugun nima oʻtiladi --- */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-sm font-semibold">Bugun nima oʻtiladi</h2>

        {todayPlans.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-foreground-muted">
            Bugun rejasi tayyor boʻlgan fan boʻyicha darsingiz yoʻq.
          </div>
        ) : (
          <ul className="space-y-3">
            {todayPlans.map(({ lesson, plan }) => (
              <li
                key={lesson.id}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classColor(lesson.className).block}`}
                      >
                        {lesson.className}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        {lesson.subject} · {lesson.period}-para · {lesson.startTime}
                      </span>
                      <span className="text-xs text-foreground-muted">
                        Dastur: {programYear(lesson.className)}-yil
                      </span>
                    </div>

                    <p className="mt-2 font-medium">
                      {plan!.title ? plan!.title.title : "Reja tugagan"}
                    </p>
                    {plan!.title?.model && (
                      <p className="mt-0.5 text-sm text-foreground-muted">
                        Model / amaliyot: {plan!.title.model}
                      </p>
                    )}
                  </div>

                  <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground-muted">
                    {plan!.termName} · {plan!.human}-dars
                  </span>
                </div>

                {plan!.card && <CardBody card={plan!.card} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Chorak rejasi --- */}
      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Chorak rejasi</h2>
          <div role="tablist" aria-label="Sinf tanlash" className="flex gap-2">
            {PLAN_CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={selected === c}
                onClick={() => {
                  setSelected(c);
                  setOpenCard(null);
                }}
                className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  selected === c
                    ? "border-brand bg-brand-tint text-brand-dark"
                    : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                }`}
              >
                {c} · {programYear(c)}-yil
              </button>
            ))}
          </div>
        </div>

        <ol className="overflow-hidden rounded-xl border border-border bg-surface">
          {titles.map((item) => {
            const isDone = item.i < done;
            const isCurrent = item.i === done;
            const card = PLAN_CARDS[`${selected}|${item.i}`] ?? null;
            const isOpen = openCard === item.i;

            return (
              <li
                key={item.i}
                className={`border-b border-border last:border-0 ${
                  isCurrent ? "bg-brand-tint/40" : ""
                }`}
              >
                <div className="flex items-start gap-3 px-4 py-2.5">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      isDone
                        ? "bg-success-tint text-success"
                        : isCurrent
                          ? "bg-brand text-brand-foreground"
                          : "bg-surface-muted text-foreground-muted"
                    }`}
                  >
                    {isDone ? "✓" : item.i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${isCurrent ? "font-semibold" : ""}`}>
                      {item.title}
                    </p>
                    {item.model && (
                      <p className="mt-0.5 text-xs text-foreground-muted">{item.model}</p>
                    )}
                  </div>

                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-brand-foreground">
                      Bugun
                    </span>
                  )}

                  {card && (
                    <button
                      type="button"
                      onClick={() => setOpenCard(isOpen ? null : item.i)}
                      aria-expanded={isOpen}
                      className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {isOpen ? "Yopish" : "Kartochka"}
                    </button>
                  )}
                </div>

                {isOpen && card && <CardBody card={card} />}
              </li>
            );
          })}
        </ol>

        <p className="mt-2 text-xs text-foreground-muted">
          Reja Tarbion Dars Rejalar Bazasidan olingan. Chorakda{" "}
          {titles.length} ta dars, hozirgacha {done} tasi oʻtilgan.
        </p>
      </section>
    </TeacherShell>
  );
}

/** Dars kartochkasi mazmuni (MET-02). */
function CardBody({ card }: { card: PlanCard }) {
  return (
    <div className="border-t border-border bg-surface-muted/30 px-4 py-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {card.maqsad && <Block title="Maqsad" items={card.maqsad} />}
        {card.resurslar && <Block title="Kerakli jihozlar" items={card.resurslar} />}
        {card.lugat && <Block title="Lugʻat" items={card.lugat} />}
        {card.softSkill && <Block title="Yumshoq koʻnikma" items={[card.softSkill]} />}
      </div>

      {card.nazariya && <Steps title="Nazariy qism" steps={card.nazariya} />}
      {card.amaliy && <Steps title="Amaliy qism" steps={card.amaliy} />}

      {card.uyga && (
        <Block
          title="Uyga vazifa"
          items={Array.isArray(card.uyga) ? card.uyga : [card.uyga]}
        />
      )}
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3 first:mt-0">
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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </p>
      <ol className="space-y-2.5">
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
