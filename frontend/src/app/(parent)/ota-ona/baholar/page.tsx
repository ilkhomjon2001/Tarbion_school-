"use client";

import { useState } from "react";

import { GradeTrend, TrendBadge } from "@/components/parent/GradeTrend";
import { ParentShell } from "@/components/parent/ParentShell";
import { HOMEWORK, RECENT_GRADES, SUBJECT_SUMMARY } from "@/lib/parent/data";
import { useChild } from "@/lib/parent/useChild";

/**
 * Baholar (OTA-04) va uy vazifasi holati (OTA-05).
 *
 * Ikkalasi bitta boʻlimda: ota-ona uchun bular bitta savolning ikki
 * tomoni — "oʻqishi qanday ketyapti?".
 */

type View = "subjects" | "homework";

const HW_LABELS: Record<string, { text: string; tone: string }> = {
  assigned: { text: "Topshirilmagan", tone: "bg-surface-muted text-foreground-muted" },
  submitted: { text: "Topshirdi, tekshirilmoqda", tone: "bg-info-tint text-info" },
  late: { text: "Kechikkan", tone: "bg-danger-tint text-danger" },
  graded: { text: "Baholangan", tone: "bg-success-tint text-success" },
};

export default function ParentGradesPage() {
  const [child, setChild] = useChild();
  const [view, setView] = useState<View>("subjects");

  const subjects = SUBJECT_SUMMARY[child.id] ?? [];
  const recent = RECENT_GRADES[child.id] ?? [];
  const homework = HOMEWORK[child.id] ?? [];

  const overall =
    subjects.length > 0
      ? (subjects.reduce((s, x) => s + x.average, 0) / subjects.length).toFixed(1)
      : "—";

  return (
    <ParentShell title="Baholar" child={child} onChildChange={setChild}>
      <div className="mb-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-foreground-muted">
          Umumiy oʻrtacha
        </p>
        <p className="mt-1 text-3xl font-bold text-brand-dark">{overall}</p>
        <p className="mt-0.5 text-sm text-foreground-muted">
          {subjects.length} ta fan · joriy chorak
        </p>
      </div>

      <div role="tablist" aria-label="Koʻrinish" className="mb-4 flex gap-2">
        {(
          [
            ["subjects", "Fanlar boʻyicha"],
            ["homework", "Uy vazifasi"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`h-10 rounded-lg border px-3.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              view === key
                ? "border-brand bg-brand-tint text-brand-dark"
                : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "subjects" ? (
        <>
          <ul className="mb-5 space-y-2.5">
            {subjects.map((s) => (
              <li
                key={s.subject}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.subject}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-foreground-muted">
                    Oʻrtacha {s.average.toFixed(1)}
                    <TrendBadge values={s.trend} />
                  </p>
                </div>

                <GradeTrend values={s.trend} subject={s.subject} />

                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-wide text-foreground-muted">
                    Chorak
                  </p>
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold ${
                      s.termGrade >= 4
                        ? "bg-success-tint text-success"
                        : s.termGrade === 3
                          ? "bg-warning-tint text-warning"
                          : "bg-danger-tint text-danger"
                    }`}
                  >
                    {s.termGrade}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <section>
            <h2 className="mb-2.5 text-sm font-semibold">Soʻnggi baholar</h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <caption className="sr-only">
                  {child.shortName}ning soʻnggi baholari
                </caption>
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-foreground-muted">
                    <th scope="col" className="px-4 py-2.5 font-medium">Sana</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Fan</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Turi</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-medium">Baho</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((g, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-foreground-muted">
                        {g.date}
                      </td>
                      <td className="px-4 py-2.5">
                        {g.subject}
                        {g.comment && (
                          <span className="mt-0.5 block text-xs text-foreground-muted">
                            {g.comment}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-foreground-muted">
                        {g.kind === "control" ? "Nazorat ishi" : "Joriy"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold ${
                            g.value >= 4
                              ? "bg-success-tint text-success"
                              : g.value === 3
                                ? "bg-warning-tint text-warning"
                                : "bg-danger-tint text-danger"
                          }`}
                        >
                          {g.value}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <ul className="space-y-2.5">
          {homework.map((h) => {
            const badge = HW_LABELS[h.status];
            return (
              <li key={h.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground-muted">{h.subject}</p>
                    <p className="mt-0.5 font-medium">{h.title}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.tone}`}
                  >
                    {badge.text}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground-muted">
                  <span>
                    Muddat: <span className="text-foreground">{h.dueAt}</span>
                  </span>
                  {h.score !== null && (
                    <span>
                      Baho:{" "}
                      <span className="font-semibold text-success">
                        {h.score}/{h.maxScore}
                      </span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ParentShell>
  );
}
