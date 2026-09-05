"use client";

import { useEffect, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { messageOf } from "@/components/shared/LiveSession";
import { GRADE_KIND_LABELS } from "@/lib/labels";
import { useChild } from "@/lib/parent/useChild";
import { fetchSubjectGrades, fetchTermGrades } from "@/lib/student/api";
import type { StudentTermGradeOut } from "@/lib/api/types.gen";
import type { SubjectGradeSummary } from "@/lib/types";

/**
 * Baholar (OTA-04) — BAZADAN.
 *
 * Uy vazifasi (OTA-05) endi alohida boʻlimda — `/ota-ona/vazifalar`
 * (ilgari shu sahifada ichki yorliq edi).
 *
 * Maʼlumot qatlami oʻquvchi kabineti bilan UMUMIY (`lib/student/api.ts`):
 * `journal` endpointlaridan oʻqiydi, kim qaysi oʻquvchini koʻrishini
 * server hal qiladi (X-1) — bu yerda faqat farzand tanlanadi.
 *
 * Chorak bahosi (JUR-04) alohida boʻlimda — faqat YAKUNLANGANLARI
 * koʻrinadi. Yakunlanmagan chorakning oraliq koʻrsatkichi oilaga
 * berilmaydi: u har baho qoʻyilganda siljiydi va rasmiy baho deb
 * tushunilib qolardi. Bu qoida serverda.
 *
 * Imtihonlar boʻlimi hozircha YOʻQ — backend'da yozilmagan, soxta
 * natija koʻrsatilmaydi.
 */

const GRADE_TONE = (value: number) =>
  value >= 4
    ? "bg-success-tint text-success"
    : value === 3
      ? "bg-warning-tint text-warning"
      : "bg-danger-tint text-danger";

/** Chorak nomi boʻyicha guruhlaydi — tartib serverdan keladi. */
function CHORAKLAR(
  rows: StudentTermGradeOut[],
): Array<[string, StudentTermGradeOut[]]> {
  const map = new Map<string, StudentTermGradeOut[]>();
  for (const r of rows) {
    const bor = map.get(r.term_name);
    if (bor) bor.push(r);
    else map.set(r.term_name, [r]);
  }
  return [...map.entries()];
}

export default function ParentGradesPage() {
  const [child, setChild] = useChild();
  const [subjects, setSubjects] = useState<SubjectGradeSummary[] | null>(null);
  const [terms, setTerms] = useState<StudentTermGradeOut[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!child.id) return;
    let alive = true;
    setSubjects(null);
    setTerms([]);
    setError("");
    void (async () => {
      try {
        const [grades, chorak] = await Promise.all([
          fetchSubjectGrades(child.id),
          fetchTermGrades(child.id),
        ]);
        if (alive) {
          setSubjects(grades);
          setTerms(chorak);
        }
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

      {terms.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2.5 text-sm font-semibold">Chorak baholari</h2>
          <ul className="space-y-2">
            {CHORAKLAR(terms).map(([chorak, qatorlar]) => (
              <li key={chorak} className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-2.5 text-sm font-medium">{chorak}</p>
                <ul className="flex flex-wrap gap-2">
                  {qatorlar.map((t) => (
                    <li
                      key={`${t.term_id}-${t.subject_id}`}
                      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
                    >
                      <span className="text-sm">{t.subject_name}</span>
                      <span
                        className={`num inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${GRADE_TONE(t.value)}`}
                      >
                        {t.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-foreground-muted">
            Chorak bahosi vaznlar boʻyicha hisoblanadi va chorak yakunlangach
            koʻrinadi. Savolingiz boʻlsa sinf rahbariga murojaat qiling.
          </p>
        </section>
      )}

      {subjects === null ? (
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
        )}
    </ParentShell>
  );
}
