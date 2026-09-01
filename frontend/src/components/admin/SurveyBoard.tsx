"use client";

/**
 * Soʻrovnomalar — BAZADAN.
 *
 * Administrator tuzadi va faollashtiradi, ota-onalar kabinetida
 * baholaydi, natija shu yerda ustoz kesimida jamlanadi.
 *
 * Natija ANONIM: javoblarda ota-onaning ismi yoʻq, faqat sinf.
 * Holat yoʻli bir tomonlama: qoralama → faol → yopilgan. Qayta
 * ochilsa eski va yangi javoblar aralashib ketardi.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BarChartIcon, PlusIcon } from "@/components/ui/icons";
import { apiXato } from "@/lib/school/api";
import {
  createSurvey,
  DEFAULT_QUESTIONS,
  fetchSurveyResults,
  fetchSurveys,
  setSurveyStatus,
  SURVEY_STATUS_LABELS,
  type SurveyOut,
  type TeacherResultOut,
} from "@/lib/surveys/api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50";

const STATUS_TONES: Record<string, "neutral" | "success" | "info"> = {
  draft: "neutral",
  active: "success",
  closed: "info",
};

export function SurveyBoard() {
  const [surveys, setSurveys] = useState<SurveyOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openResults, setOpenResults] = useState<SurveyOut | null>(null);

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS.join("\n"));

  const yukla = useCallback(async () => {
    try {
      setSurveys(await fetchSurveys());
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Soʻrovnomalarni olib boʻlmadi."));
      setSurveys([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function amal(f: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await f();
      await yukla();
    } catch (err) {
      setError(apiXato(err, "Amalni bajarib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Soʻrovnomalar</h1>
          <p className="text-sm text-foreground-muted">
            Ota-onalar ustozlarni baholaydi — javoblar anonim jamlanadi
          </p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} className={primaryBtn}>
          <PlusIcon className="h-4 w-4" />
          Yangi soʻrovnoma
        </button>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const savollar = questions
              .split("\n")
              .map((q) => q.trim())
              .filter(Boolean);
            if (!title.trim() || savollar.length === 0) return;
            void amal(async () => {
              await createSurvey(title.trim(), savollar);
              setTitle("");
              setQuestions(DEFAULT_QUESTIONS.join("\n"));
              setCreating(false);
            });
          }}
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sarlavha</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 160))}
              placeholder="Masalan, 1-chorak yakuni boʻyicha soʻrovnoma"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Savollar — har qatorda bittadan (1–5 shkalada baholanadi)
            </span>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className={ghostBtn}>
              Bekor qilish
            </button>
            <button type="submit" disabled={busy} className={primaryBtn}>
              Qoralama sifatida saqlash
            </button>
          </div>
        </form>
      )}

      {surveys === null ? (
        <ListSkeleton count={3} />
      ) : surveys.length === 0 ? (
        <EmptyState
          icon={<BarChartIcon className="h-5 w-5" />}
          title="Soʻrovnoma yoʻq"
          description="«Yangi soʻrovnoma» bilan birinchisini tuzing."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {surveys.map((s) => (
            <article
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{s.title}</p>
                <p className="mt-0.5 text-sm text-foreground-muted">
                  <span className="num">{s.questions.length}</span> savol ·{" "}
                  <span className="num">{s.response_count}</span> javob ·{" "}
                  {new Date(s.created_at).toLocaleDateString("uz-UZ")}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <Badge tone={STATUS_TONES[s.status] ?? "neutral"}>
                  {SURVEY_STATUS_LABELS[s.status] ?? s.status}
                </Badge>
                {s.status === "draft" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void amal(() => setSurveyStatus(s.id, "active"))}
                    className={primaryBtn}
                  >
                    Faollashtirish
                  </button>
                )}
                {s.status === "active" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void amal(() => setSurveyStatus(s.id, "closed"))}
                    className={ghostBtn}
                  >
                    Yopish
                  </button>
                )}
                {s.response_count > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenResults(s)}
                    className={ghostBtn}
                  >
                    Natijalar
                  </button>
                )}
              </span>
            </article>
          ))}
        </div>
      )}

      {openResults && (
        <ResultsPanel survey={openResults} onClose={() => setOpenResults(null)} />
      )}
    </div>
  );
}

function ResultsPanel({ survey, onClose }: { survey: SurveyOut; onClose: () => void }) {
  const [rows, setRows] = useState<TeacherResultOut[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSurveyResults(survey.id)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [survey.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Soʻrovnoma natijalari"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[520px] flex-col gap-3 overflow-y-auto bg-surface p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">{survey.title}</h2>
            <p className="text-xs text-foreground-muted">
              Javoblar anonim — ism emas, sinf koʻrsatiladi
            </p>
          </div>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Yopish
          </button>
        </div>

        {error ? (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            Natijalarni olib boʻlmadi.
          </p>
        ) : rows === null ? (
          <ListSkeleton count={3} />
        ) : rows.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
            Hali javob yoʻq.
          </p>
        ) : (
          rows.map((r) => (
            <article
              key={r.teacher_id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{r.teacher_name}</p>
                <p className="num text-lg font-bold text-brand-dark">{r.average.toFixed(1)}</p>
              </div>
              <p className="mt-0.5 text-xs text-foreground-muted">
                <span className="num">{r.response_count}</span> javob
              </p>

              <div className="mt-2 flex flex-col gap-1">
                {r.criteria.map((c) => (
                  <div key={c.text} className="flex items-center gap-2 text-xs">
                    <span className="w-44 shrink-0 truncate text-foreground-muted">{c.text}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${(c.average / 5) * 100}%` }}
                      />
                    </span>
                    <span className="num w-8 text-right font-medium text-foreground">
                      {c.average.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>

              {r.comments.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-2">
                  {r.comments.map((c) => (
                    <li
                      key={`${c.class_name}-${c.text}`}
                      className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground"
                    >
                      <span className="font-medium text-foreground-muted">
                        {c.class_name} ota-onasi:
                      </span>{" "}
                      {c.text}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))
        )}
      </aside>
    </div>
  );
}
