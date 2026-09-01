"use client";

/**
 * Imtihonlar — BAZADAN.
 *
 * Yaratish, ball kiritish (sinfning toʻliq roʻyxati ustida — kim
 * qolgani darhol koʻrinadi), holat. Oʻtkazilgan imtihon rejaga
 * qaytmaydi: unda ballar bor.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ClipboardIcon, PlusIcon } from "@/components/ui/icons";
import {
  createExam,
  enterExamResults,
  EXAM_KIND_LABELS,
  EXAM_STATUS_LABELS,
  fetchExamResults,
  fetchExams,
  setExamStatus,
  type ExamOut,
  type ExamResultRowOut,
} from "@/lib/exams/api";
import { apiXato, useSchoolDirectory } from "@/lib/school/api";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50";

const STATUS_TONES: Record<string, "info" | "success" | "neutral"> = {
  rejada: "info",
  otkazildi: "success",
  bekor: "neutral",
};

export function ExamsBoard() {
  const dir = useSchoolDirectory();
  const [exams, setExams] = useState<ExamOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [entering, setEntering] = useState<ExamOut | null>(null);

  const [form, setForm] = useState({
    title: "",
    kind: "oylik",
    subject_id: "",
    class_id: "",
    exam_date: "",
  });

  const yukla = useCallback(async () => {
    try {
      setExams(await fetchExams());
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Imtihonlarni olib boʻlmadi."));
      setExams([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  async function yarat(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.subject_id || !form.class_id || !form.exam_date) return;
    setBusy(true);
    setError(null);
    try {
      await createExam({ ...form, title: form.title.trim() });
      setForm({ title: "", kind: "oylik", subject_id: "", class_id: "", exam_date: "" });
      setCreating(false);
      await yukla();
    } catch (err) {
      setError(apiXato(err, "Imtihonni yaratib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Imtihonlar</h1>
          <p className="text-sm text-foreground-muted">
            Rejalashtirish, ball kiritish va natijalar
          </p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} className={primaryBtn}>
          <PlusIcon className="h-4 w-4" />
          Yangi imtihon
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {creating && (
          <form
            onSubmit={yarat}
            className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-2"
          >
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Nomi</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 160) })}
                placeholder="Masalan, 1-oylik nazorat ishi"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Turi</span>
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
                className={inputClass}
              >
                {Object.entries(EXAM_KIND_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Sana</span>
              <input
                type="date"
                value={form.exam_date}
                onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Fan</span>
              <select
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Tanlang…</option>
                {dir.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf</span>
              <select
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Tanlang…</option>
                {dir.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" onClick={() => setCreating(false)} className={ghostBtn}>
                Bekor qilish
              </button>
              <button type="submit" disabled={busy} className={primaryBtn}>
                Rejaga qoʻshish
              </button>
            </div>
        </form>
      )}

      {exams === null ? (
          <ListSkeleton count={4} />
        ) : exams.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon className="h-5 w-5" />}
            title="Imtihon yoʻq"
            description="«Yangi imtihon» bilan birinchisini rejalashtiring."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {exams.map((x) => (
              <article
                key={x.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{x.title}</p>
                  <p className="num mt-0.5 text-sm text-foreground-muted">
                    {x.subject_name} · {x.class_name} · {EXAM_KIND_LABELS[x.kind] ?? x.kind} ·{" "}
                    {x.exam_date}
                  </p>
                  {x.stats.entered > 0 && (
                    <p className="num mt-0.5 text-xs text-foreground-muted">
                      Oʻrtacha <strong className="text-foreground">{x.stats.average}</strong> ·
                      oʻzlashtirish {x.stats.pass_rate}% · {x.stats.entered} ball
                      {x.stats.absent > 0 && ` · ${x.stats.absent} kelmagan`}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONES[x.status] ?? "neutral"}>
                    {EXAM_STATUS_LABELS[x.status] ?? x.status}
                  </Badge>
                  {x.status !== "bekor" && (
                    <button type="button" onClick={() => setEntering(x)} className={primaryBtn}>
                      Ballar
                    </button>
                  )}
                  {x.status === "rejada" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await setExamStatus(x.id, "bekor");
                          await yukla();
                        } catch (err) {
                          setError(apiXato(err, "Bekor qilib boʻlmadi."));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger disabled:opacity-40"
                    >
                      Bekor
                    </button>
                  )}
                </span>
              </article>
            ))}
          </div>
        )}

      {entering && (
        <ResultsDrawer
          exam={entering}
          onClose={() => setEntering(null)}
          onSaved={() => {
            setEntering(null);
            void yukla();
          }}
        />
      )}
    </div>
  );
}

/** Ball kiritish — sinfning TOʻLIQ roʻyxati ustida. */
function ResultsDrawer({
  exam,
  onClose,
  onSaved,
}: {
  exam: ExamOut;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<ExamResultRowOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchExamResults(exam.id)
      .then((r) => alive && setRows(r))
      .catch((err) => alive && setError(apiXato(err, "Roʻyxatni olib boʻlmadi.")));
    return () => {
      alive = false;
    };
  }, [exam.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(i: number, patch: Partial<ExamResultRowOut>) {
    setRows((old) => old && old.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function saqla() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      await enterExamResults(
        exam.id,
        rows
          .filter((r) => r.absent || r.score !== null)
          .map((r) => ({ student_id: r.student_id, score: r.score, absent: r.absent })),
      );
      onSaved();
    } catch (err) {
      setError(apiXato(err, "Saqlab boʻlmadi."));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Ball kiritish"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[440px] flex-col gap-3 overflow-y-auto bg-surface p-4 shadow-xl"
      >
        <div>
          <h2 className="text-base font-semibold text-foreground">{exam.title}</h2>
          <p className="text-xs text-foreground-muted">
            {exam.class_name} · ball 0–100, kelmaganga «K» belgilanadi
          </p>
        </div>

        {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

        {rows === null ? (
          <ListSkeleton count={6} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <li
                key={r.student_id}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm text-foreground">{r.student_name}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={r.absent}
                    value={r.score ?? ""}
                    onChange={(e) =>
                      set(i, {
                        score: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    aria-label={`${r.student_name} bali`}
                    className="num h-8 w-16 rounded-lg border border-border bg-surface px-2 text-sm outline-none focus-visible:border-brand disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => set(i, { absent: !r.absent, score: null })}
                    aria-pressed={r.absent}
                    title="Imtihonga kelmadi"
                    className={`focus-ring h-8 w-8 rounded-lg border text-xs font-semibold transition-colors ${
                      r.absent
                        ? "border-danger bg-danger-tint text-danger"
                        : "border-border text-foreground-muted hover:bg-surface"
                    }`}
                  >
                    K
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Yopish
          </button>
          <button type="button" disabled={busy || !rows} onClick={() => void saqla()} className={primaryBtn}>
            Ballarni saqlash
          </button>
        </div>
      </aside>
    </div>
  );
}
