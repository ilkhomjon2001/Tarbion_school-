"use client";

/**
 * Uy vazifasini tekshirish va baholash (UYV-03, UYV-06).
 *
 * Maʼlumot serverdan. Har bir ish ALOHIDA saqlanadi: ustoz bittasini
 * tekshirib darrov keyingisiga oʻtadi va yarim saqlangan holat qolmaydi.
 * Eski ekranda "hammasini saqlash" bor edi — u qoʻshni qatorlardagi
 * saqlanmagan oʻzgarishlarni ham bazaga tushirib yuborardi.
 *
 * Baho jurnalga ham tushadi — buni SERVER qiladi (JUR-04): chorak
 * bahosi bitta manbadan hisoblanishi kerak.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ArrowLeftIcon, CheckIcon, ClipboardIcon } from "@/components/ui/icons";
import {
  SUBMISSION_LABELS,
  SUBMISSION_TONES,
  apiXato,
  fetchSubmissions,
  formatDue,
  gradeSubmission,
  returnSubmission,
  type SubmissionListOut,
  type SubmissionOut,
} from "@/lib/teacher/journal-api";

type Filter = "pending" | "graded" | "missing" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "Tekshirilmagan" },
  { id: "graded", label: "Baholangan" },
  { id: "missing", label: "Topshirmagan" },
  { id: "all", label: "Barchasi" },
];

export default function HomeworkReviewPage() {
  const params = useParams<{ id: string }>();

  const [data, setData] = useState<SubmissionListOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchSubmissions(params.id));
    } catch (err) {
      setError(apiXato(err, "Vazifani ochib boʻlmadi."));
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Bitta qator yangilanganda butun roʻyxatni qayta soʻramaymiz. */
  function patch(row: SubmissionOut) {
    setData((d) =>
      d === null ? d : { ...d, rows: d.rows.map((r) => (r.id === row.id ? row : r)) },
    );
  }

  const rows = useMemo(() => {
    if (data === null) return [];
    switch (filter) {
      case "pending":
        return data.rows.filter((r) => r.status === "submitted" || r.status === "late");
      case "graded":
        return data.rows.filter((r) => r.status === "graded");
      case "missing":
        return data.rows.filter((r) => r.status === "assigned" || r.status === "returned");
      default:
        return data.rows;
    }
  }, [data, filter]);

  const pending =
    data?.rows.filter((r) => r.status === "submitted" || r.status === "late").length ?? 0;

  return (
    <TeacherShell
      title={data?.title ?? "Uy vazifasi"}
      subtitle={
        data === null
          ? undefined
          : `Muddat: ${formatDue(data.due_at)} · ${pending} ta tekshirilmagan`
      }
      actions={
        <Link
          href="/teacher/vazifa"
          className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Roʻyxatga
        </Link>
      }
    >
      {error && <ErrorState description={error} />}

      {data === null ? (
        !error && <ListSkeleton count={4} />
      ) : (
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="Filtr" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(f.id)}
                  className={`focus-ring rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    on
                      ? "border-brand bg-brand-tint text-brand-dark"
                      : "border-border text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon className="h-5 w-5" />}
              title={
                filter === "pending" ? "Tekshiriladigan ish yoʻq" : "Bu boʻlimda ish yoʻq"
              }
              description={
                filter === "pending"
                  ? "Barcha topshirilgan ishlar baholangan."
                  : "Boshqa filtrni tanlab koʻring."
              }
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <SubmissionCard
                  key={row.id}
                  row={row}
                  maxScore={data.max_score}
                  onChanged={patch}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </TeacherShell>
  );
}

/** Bitta ish — baho, izoh yoki qayta ishlashga qaytarish. */
function SubmissionCard({
  row,
  maxScore,
  onChanged,
}: {
  row: SubmissionOut;
  maxScore: number;
  onChanged: (row: SubmissionOut) => void;
}) {
  const [score, setScore] = useState<number | null>(row.score);
  const [comment, setComment] = useState(row.teacher_comment ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topshirmagan = row.status === "assigned";

  async function save() {
    if (score === null) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await gradeSubmission(row.id, score, comment.trim() || null));
      setSaved(true);
    } catch (err) {
      setError(apiXato(err, "Bahoni saqlab boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  async function back() {
    setBusy(true);
    setError(null);
    try {
      onChanged(await returnSubmission(row.id, comment.trim()));
      setSaved(true);
    } catch (err) {
      setError(apiXato(err, "Qaytarib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{row.full_name}</p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {row.submitted_at ? `Topshirdi: ${formatDue(row.submitted_at)}` : "Topshirmagan"}
          </p>
        </div>
        <Badge tone={SUBMISSION_TONES[row.status] ?? "neutral"}>
          {SUBMISSION_LABELS[row.status] ?? row.status}
        </Badge>
      </div>

      {row.answer_text && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
          {row.answer_text}
        </p>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {topshirmagan ? (
        <p className="mt-3 text-xs text-foreground-muted">
          Ish topshirilmagan — baholash uchun avval oʻquvchi topshirishi kerak.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-foreground">Ball</span>
            {Array.from({ length: maxScore }, (_, i) => i + 1).map((n) => {
              const on = score === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  aria-pressed={on}
                  onClick={() => {
                    setScore(on ? null : n);
                    setSaved(false);
                  }}
                  className={`focus-ring num h-9 w-9 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40 ${
                    on
                      ? "border-transparent bg-brand text-brand-foreground"
                      : "border-border text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value.slice(0, 2000));
              setSaved(false);
            }}
            rows={2}
            placeholder="Izoh — qaytarish uchun majburiy"
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || score === null}
              onClick={save}
              className="focus-ring inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "Saqlanmoqda…" : "Baholash"}
            </button>
            <button
              type="button"
              disabled={busy || comment.trim().length < 3}
              onClick={back}
              title="Izoh yozilmasa qaytarib boʻlmaydi"
              className="focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              Qayta ishlashga qaytarish
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckIcon className="h-3.5 w-3.5" />
                Saqlandi
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
