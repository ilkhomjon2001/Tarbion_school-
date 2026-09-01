"use client";

/**
 * Bitta darsga baho qoʻyish (JUR-01, JUR-03).
 *
 * Davomat saqlangach shu komponent ochiladi: ustoz boshqa ekranga
 * oʻtmaydi — mavzu, davomat va baho bitta oynada.
 *
 * Qoidalar SERVERDA, bu yerda emas:
 *   `gradable` / `block_reason` — kimga baho qoʻyish mumkinligi
 *   `editable`                  — DAV-03 oynasi ochiqmi
 * Frontend ularni faqat chizadi (CLAUDE.md 7-qoida).
 *
 * Tezlik: katak tanlanganda klaviaturadan raqam bosish yetarli. Ustoz
 * 25 kishilik sinfga baho qoʻyayotganda sichqoncha bilan kichik
 * tugmalarni nishonga olib oʻtirmaydi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  GRADE_KIND_LABELS,
  apiXato,
  fetchLessonJournal,
  saveLessonGrades,
  type LessonJournalOut,
} from "@/lib/teacher/journal-api";
import { ATTENDANCE_LABELS, type AttendanceStatus } from "@/lib/teacher/types";

const KIND_TONE: Record<string, string> = {
  current: "bg-surface-muted text-foreground",
  control: "bg-info-tint text-info ring-1 ring-inset ring-info/30",
  term: "bg-brand-tint text-brand-dark ring-1 ring-inset ring-brand/30",
  annual: "bg-warning-tint text-warning ring-1 ring-inset ring-warning/30",
};

export function LessonGradeBook({
  lessonId,
  /** Tashqaridan berilgan jurnal — davomat saqlangach qayta soʻralmasin. */
  initial,
}: {
  lessonId: string;
  initial?: LessonJournalOut | null;
}) {
  const [journal, setJournal] = useState<LessonJournalOut | null>(initial ?? null);
  const [loading, setLoading] = useState(initial == null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [kind, setKind] = useState("current");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJournal(await fetchLessonJournal(lessonId));
    } catch (err) {
      setError(apiXato(err, "Jurnalni ochib boʻlmadi."));
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    if (initial == null) void load();
  }, [initial, load]);

  const gradable = useMemo(
    () => (journal?.students ?? []).filter((s) => s.gradable),
    [journal],
  );
  const blocked = useMemo(
    () => (journal?.students ?? []).filter((s) => !s.gradable),
    [journal],
  );

  async function put(studentId: string, value: number | null) {
    if (journal === null) return;
    setSaving(studentId);
    setError(null);
    try {
      setJournal(await saveLessonGrades(lessonId, [{ student_id: studentId, value }], { kind }));
    } catch (err) {
      setError(apiXato(err, "Bahoni saqlab boʻlmadi."));
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <ListSkeleton count={5} />;
  if (error && journal === null) return <ErrorState description={error} />;
  if (journal === null) return null;

  const qoyilgan = journal.students.filter((s) => s.grade !== null).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          <span className="num font-medium text-foreground">{qoyilgan}</span> /{" "}
          <span className="num">{gradable.length}</span> baho qoʻyildi
          {blocked.length > 0 && (
            <>
              {" · "}
              <span className="num">{blocked.length}</span> ta oʻquvchiga qoʻyib boʻlmaydi
            </>
          )}
        </p>

        {journal.editable && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-foreground-muted">Baho turi</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            >
              {Object.entries(GRADE_KIND_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!journal.editable && (
        <p className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
          Bu darsga baho qoʻyish muddati tugagan. Tuzatish kerak boʻlsa administratorga
          murojaat qiling — oʻzgarish audit jurnaliga tushadi.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <ul className="flex flex-col gap-1.5">
        {journal.students.map((s) => (
          <li
            key={s.student_id}
            className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
              s.gradable ? "border-border bg-surface" : "border-border bg-surface-muted/60"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {s.full_name}
              </span>
              {s.attendance && s.attendance !== "present" && (
                <span className="mt-0.5 inline-block">
                  <Badge tone={s.attendance === "late" ? "warning" : "danger"}>
                    {ATTENDANCE_LABELS[s.attendance as AttendanceStatus] ?? s.attendance}
                  </Badge>
                </span>
              )}
            </span>

            {s.gradable ? (
              <GradeButtons
                max={journal.max_value}
                value={s.grade?.value ?? null}
                kind={s.grade?.kind ?? kind}
                disabled={!journal.editable || saving === s.student_id}
                onPick={(v) => void put(s.student_id, v)}
              />
            ) : (
              <span className="text-xs text-foreground-muted">{s.block_reason}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-foreground-muted">
        Baho darsga bogʻlanadi — boshqa kunning bahosi bu yerdan oʻzgarmaydi. Har
        oʻzgarish audit jurnaliga tushadi.
      </p>
    </div>
  );
}

/**
 * 1…5 tugmalari + tanlanganini bosib olib tashlash.
 *
 * Bahoni olib tashlash kerak: ustoz xato bosishi oddiy hol. Server uni
 * arxivlaydi, oʻchirmaydi (CLAUDE.md 1-qoida).
 */
function GradeButtons({
  max,
  value,
  kind,
  disabled,
  onPick,
}: {
  max: number;
  value: number | null;
  kind: string;
  disabled: boolean;
  onPick: (value: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const options = useMemo(
    () => Array.from({ length: max }, (_, i) => max - i).reverse(),
    [max],
  );

  /** Katak fokusda boʻlsa raqam tugmasi ham ishlaydi. */
  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const raqam = Number(e.key);
    if (Number.isInteger(raqam) && raqam >= 1 && raqam <= max) {
      e.preventDefault();
      onPick(raqam);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onPick(null);
    }
  }

  return (
    <div ref={ref} onKeyDown={onKeyDown} className="flex shrink-0 items-center gap-1">
      {options.map((n) => {
        const on = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={`${n} baho`}
            onClick={() => onPick(on ? null : n)}
            className={`focus-ring num h-9 w-9 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40 ${
              on
                ? `border-transparent ${KIND_TONE[kind] ?? KIND_TONE.current}`
                : "border-border text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
