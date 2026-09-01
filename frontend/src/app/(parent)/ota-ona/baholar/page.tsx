"use client";

import { useEffect, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { messageOf } from "@/components/shared/LiveSession";
import { GRADE_KIND_LABELS } from "@/lib/labels";
import { SUBMISSION_LABELS, type SubmissionStatus } from "@/lib/contracts";
import { useChild } from "@/lib/parent/useChild";
import { fetchHomeworkList, fetchSubjectGrades } from "@/lib/student/api";
import type { Homework, SubjectGradeSummary } from "@/lib/types";

/**
 * Baholar (OTA-04) va uy vazifasi holati (OTA-05) — BAZADAN.
 *
 * Maʼlumot qatlami oʻquvchi kabineti bilan UMUMIY (`lib/student/api.ts`):
 * ikkalasi ham `journal` endpointlaridan oʻqiydi, kim qaysi oʻquvchini
 * koʻrishini server hal qiladi (X-1) — bu yerda faqat farzand tanlanadi.
 *
 * Imtihonlar va chorak bahosi boʻlimlari hozircha YOʻQ: ular backend'da
 * yozilmagan (imtihon moduli, T-031) — soxta natija koʻrsatilmaydi.
 */

type View = "subjects" | "homework";

const HW_TONES: Record<SubmissionStatus, string> = {
  assigned: "bg-surface-muted text-foreground-muted",
  submitted: "bg-info-tint text-info",
  late: "bg-warning-tint text-warning",
  graded: "bg-success-tint text-success",
  returned: "bg-danger-tint text-danger",
};

const GRADE_TONE = (value: number) =>
  value >= 4
    ? "bg-success-tint text-success"
    : value === 3
      ? "bg-warning-tint text-warning"
      : "bg-danger-tint text-danger";

export default function ParentGradesPage() {
  const [child, setChild] = useChild();
  const [view, setView] = useState<View>("subjects");
  const [subjects, setSubjects] = useState<SubjectGradeSummary[] | null>(null);
  const [homework, setHomework] = useState<Homework[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!child.id) return;
    let alive = true;
    setSubjects(null);
    setHomework(null);
    setError("");
    void (async () => {
      try {
        const [grades, hw] = await Promise.all([
          fetchSubjectGrades(child.id),
          fetchHomeworkList(child.id),
        ]);
        if (!alive) return;
        setSubjects(grades);
        setHomework(hw);
      } catch (err) {
        if (alive) setError(messageOf(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [child.id]);

  const graded = (subjects ?? []).filter((s) => s.entries.length > 0);
  const overall =
    graded.length > 0
      ? (graded.reduce((s, x) => s + x.average, 0) / graded.length).toFixed(1)
      : "—";

  const recent = (subjects ?? [])
    .flatMap((s) => s.entries)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);

  return (
    <ParentShell title="Baholar" child={child} onChildChange={setChild}>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mb-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-foreground-muted">
          Umumiy oʻrtacha
        </p>
        <p className="num mt-1 text-3xl font-bold text-brand-dark">{overall}</p>
        <p className="mt-0.5 text-sm text-foreground-muted">
          {graded.length} ta fan boʻyicha baho bor
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
        subjects === null ? (
          <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
        ) : subjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-foreground-muted">
            Hozircha baho qoʻyilmagan.
          </p>
        ) : (
          <>
            <ul className="mb-5 space-y-2.5">
              {subjects.map((s) => (
                <li
                  key={s.subject}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.subject}</p>
                    <p className="mt-0.5 text-sm text-foreground-muted">
                      {s.entries.length > 0
                        ? `Oʻrtacha ${s.average.toFixed(1)} · ${s.entries.length} ta baho`
                        : "Hali baho yoʻq"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.entries.slice(-6).map((g) => (
                      <span
                        key={g.id}
                        title={`${GRADE_KIND_LABELS[g.kind]}${g.date ? ` · ${g.date}` : ""}`}
                        className={`num inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${GRADE_TONE(g.value)}`}
                      >
                        {g.value}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            {recent.length > 0 && (
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
                      {recent.map((g) => (
                        <tr key={g.id} className="border-b border-border last:border-0">
                          <td className="whitespace-nowrap px-4 py-2.5 text-foreground-muted">
                            {g.date || "—"}
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
                            {GRADE_KIND_LABELS[g.kind]}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`num inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold ${GRADE_TONE(g.value)}`}
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
            )}
          </>
        )
      ) : homework === null ? (
        <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
      ) : homework.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-foreground-muted">
          Hozircha uy vazifasi berilmagan.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {homework.map((h) => (
            <li key={h.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-foreground-muted">{h.subject}</p>
                  <p className="mt-0.5 font-medium">{h.title}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${HW_TONES[h.status]}`}
                >
                  {SUBMISSION_LABELS[h.status]}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground-muted">
                <span>
                  Muddat:{" "}
                  <span className="text-foreground">{h.dueDate.slice(0, 10)}</span>
                </span>
                {h.grade !== undefined && (
                  <span>
                    Baho: <span className="font-semibold text-success">{h.grade}</span>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ParentShell>
  );
}
