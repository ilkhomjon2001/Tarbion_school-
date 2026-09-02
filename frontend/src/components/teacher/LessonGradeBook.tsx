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
 *
 * Saqlash QORALAMA orqali: bosishlar avval lokal yigʻiladi, pastdagi
 * «Oʻzgarishlarni saqlash» bitta soʻrovda yuboradi. Shunda ustoz nechta
 * baho hali saqlanmaganini aniq koʻradi va tarmoq xatosida hech narsa
 * yoʻqolmaydi.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { SaveBar } from "@/components/ui/SaveBar";
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
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState("current");
  /** studentId → yangi qiymat (null = olib tashlash). Faqat FARQLAR. */
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);

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

  /** Bosish faqat qoralamani oʻzgartiradi — server «Saqlash»da. */
  function pick(studentId: string, value: number | null) {
    if (journal === null) return;
    const serverdagi =
      journal.students.find((s) => s.student_id === studentId)?.grade?.value ?? null;
    setDraft((prev) => {
      const next = { ...prev };
      if (value === serverdagi) delete next[studentId];
      else next[studentId] = value;
      return next;
    });
    setSavedAt(null);
  }

  const ozgarishlar = Object.keys(draft).length;

  async function saqla() {
    if (journal === null || ozgarishlar === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const rows = Object.entries(draft).map(([student_id, value]) => ({
        student_id,
        value,
      }));
      setJournal(await saveLessonGrades(lessonId, rows, { kind }));
      setDraft({});
      setSavedAt(
        new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
      );
    } catch (err) {
      // Qoralama SAQLANIB qoladi — ustoz qayta urinadi, hech narsa yoʻqolmaydi.
      setError(apiXato(err, "Baholarni saqlab boʻlmadi. Qayta urinib koʻring."));
    } finally {
      setSaving(false);
    }
  }

  // Saqlanmagan baho bilan sahifadan chiqishdan ogohlantirish.
  useEffect(() => {
    if (ozgarishlar === 0) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [ozgarishlar]);

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


      <ul className="flex flex-col gap-1.5">
        {journal.students.map((s) => {
          const ozgargan = s.student_id in draft;
          const qiymat = ozgargan ? draft[s.student_id] : (s.grade?.value ?? null);
          return (
          <li
            key={s.student_id}
            className={`flex flex-col gap-2 rounded-lg border px-3 py-2 transition-colors sm:flex-row sm:items-center sm:gap-3 ${
              !s.gradable
                ? "border-border bg-surface-muted/60"
                : ozgargan
                  ? "border-brand/50 bg-brand-tint/25"
                  : "border-border bg-surface"
            }`}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 text-sm font-medium text-foreground sm:truncate">
                {s.full_name}
              </span>
              {s.attendance && s.attendance !== "present" && (
                <Badge tone={s.attendance === "late" ? "warning" : "danger"}>
                  {ATTENDANCE_LABELS[s.attendance as AttendanceStatus] ?? s.attendance}
                </Badge>
              )}
            </span>

            {s.gradable ? (
              <GradeButtons
                max={journal.max_value}
                value={qiymat}
                kind={s.grade?.kind ?? kind}
                disabled={!journal.editable || saving}
                onPick={(v) => pick(s.student_id, v)}
              />
            ) : (
              !s.attendance && (
                <span className="text-xs text-foreground-muted">Davomat belgilanmagan</span>
              )
            )}
          </li>
          );
        })}
      </ul>

      {journal.editable && (
        <SaveBar
          sticky
          ozgarishlar={ozgarishlar}
          busy={saving}
          savedAt={savedAt}
          onSave={() => void saqla()}
          xato={error}
          onCancel={() => {
            setDraft({});
            setError(null);
          }}
        />
      )}

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
    <div ref={ref} onKeyDown={onKeyDown} className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
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
            className={`focus-ring num h-11 flex-1 rounded-lg border text-base font-semibold transition-colors active:scale-95 disabled:opacity-40 motion-reduce:active:scale-100 sm:h-10 sm:w-10 sm:flex-none sm:text-sm ${
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
