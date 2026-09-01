"use client";

import { useCallback, useEffect, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { useChild } from "@/lib/parent/useChild";
import {
  fetchActiveSurvey,
  respondSurvey,
  type ActiveSurveyOut,
} from "@/lib/surveys/api";

/**
 * Soʻrovnoma — ota-ona farzandiga dars beradigan ustozlarni baholaydi.
 *
 * Roʻyxat serverdan keladi va faqat oʻz ustozlarini oʻz ichiga oladi.
 * Javob ANONIM jamlanadi: natijada ism koʻrinmaydi, faqat sinf
 * («7-A ota-onasi») va matn.
 */
export default function ParentSurveyPage() {
  const [child, selectChild] = useChild();
  const [data, setData] = useState<ActiveSurveyOut | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const yukla = useCallback(async () => {
    try {
      setData(await fetchActiveSurvey());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  const survey = data?.survey ?? null;
  const savollar = survey?.questions ?? [];
  const toliq = savollar.length > 0 && savollar.every((q) => scores[q.id] >= 1);

  async function yubor(teacherId: string) {
    if (!survey || !toliq) return;
    setBusy(true);
    try {
      await respondSurvey(survey.id, teacherId, scores, comment);
      setOpen(null);
      setScores({});
      setComment("");
      await yukla();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ParentShell title="Soʻrovnoma" child={child} onChildChange={selectChild}>
      <div className="flex flex-col gap-2">
        {error ? (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            Xatolik yuz berdi. Sahifani yangilab koʻring.
          </p>
        ) : data === null ? (
          <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
        ) : survey === null ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
            Hozir faol soʻrovnoma yoʻq. Maktab soʻrovnoma eʼlon qilganda shu
            yerda koʻrinadi.
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="font-semibold text-foreground">{survey.title}</h2>
              <p className="mt-1 text-xs text-foreground-muted">
                Javoblaringiz anonim jamlanadi — natijada ismingiz koʻrinmaydi.
                Har bir ustozga bir marta javob beriladi.
              </p>
            </div>

            {data.teachers.length === 0 && (
              <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
                Baholanadigan ustozlar topilmadi.
              </p>
            )}

            {data.teachers.map((t) => {
              const ochiq = open === t.teacher_id;
              return (
                <article
                  key={t.teacher_id}
                  className="rounded-xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{t.teacher_name}</p>
                      <p className="text-xs text-foreground-muted">
                        {t.subjects.join(", ")} · {t.class_name}
                      </p>
                    </div>
                    {t.answered ? (
                      <span className="rounded-full bg-success-tint px-2.5 py-0.5 text-xs font-medium text-success">
                        Javob berilgan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(ochiq ? null : t.teacher_id);
                          setScores({});
                          setComment("");
                        }}
                        className="focus-ring inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
                      >
                        {ochiq ? "Yopish" : "Baholash"}
                      </button>
                    )}
                  </div>

                  {ochiq && !t.answered && (
                    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                      {savollar.map((q) => (
                        <div key={q.id}>
                          <p className="mb-1.5 text-sm text-foreground">{q.text}</p>
                          <div className="flex gap-1.5" role="radiogroup" aria-label={q.text}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={scores[q.id] === n}
                                onClick={() => setScores({ ...scores, [q.id]: n })}
                                className={`focus-ring num h-9 w-9 rounded-lg border text-sm font-semibold transition-colors ${
                                  scores[q.id] === n
                                    ? "border-brand bg-brand text-brand-foreground"
                                    : "border-border text-foreground-muted hover:bg-surface-muted"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value.slice(0, 500))}
                        rows={2}
                        placeholder="Izoh (ixtiyoriy, anonim koʻrsatiladi)…"
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={!toliq || busy}
                          onClick={() => void yubor(t.teacher_id)}
                          className="focus-ring inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
                        >
                          Javobni yuborish
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </>
        )}
      </div>
    </ParentShell>
  );
}
