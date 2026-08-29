"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildLessons, TODAY } from "@/lib/teacher/schedule";
import {
  GRADE_KIND_LABELS,
  GRADE_WEIGHTS,
  getGrades,
  saveGrade,
  termAverage,
  type GradeEntry,
  type GradeKind,
  type GradingScale,
} from "@/lib/teacher/store";
import { termForDate } from "@/lib/teacher/terms";
import type { AttendanceRow } from "@/lib/teacher/types";

/**
 * Baholar jurnali (JUR-01, JUR-02, JUR-03, JUR-04).
 *
 * Sinf × fan × sana kesimi: qatorlar — oʻquvchilar, ustunlar — chorak
 * boshidan bugungacha boʻlgan darslar. Katakka bosilsa baho qoʻyiladi.
 *
 * Tezlik uchun: katak tanlanganda klaviaturadan raqam bosish yetarli.
 * Ustoz 25 kishilik sinfga baho qoʻyayotganda sichqoncha bilan kichik
 * tugmalarni nishonga olib oʻtirmaydi.
 */

const KIND_TONE: Record<GradeKind, string> = {
  current: "bg-surface-muted text-foreground",
  control: "bg-info-tint text-info ring-1 ring-inset ring-info/30",
  term: "bg-brand-tint text-brand-dark ring-1 ring-inset ring-brand/30",
  annual: "bg-warning-tint text-warning ring-1 ring-inset ring-warning/30",
};

export function GradeBook({
  className,
  subject,
  students,
  readOnly = false,
}: {
  className: string;
  subject: string;
  students: AttendanceRow[];
  /** Sinf rahbari boshqa ustozning fanini faqat koʻradi. */
  readOnly?: boolean;
}) {
  // Soddalashtirildi: 5 ballik sukut boʻyicha. Maktab 100 ballikka
  // oʻtsa, bu sozlama admin panelidan keladi — har ustoz har safar
  // tanlab oʻtirmaydi.
  const scale: GradingScale = 5;
  const [kind, setKind] = useState<GradeKind>("current");
  const [book, setBook] = useState<Record<string, Record<string, GradeEntry>>>({});
  const [active, setActive] = useState<{ studentId: string; date: string } | null>(null);
  const [ready, setReady] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBook(getGrades(className, subject));
    setActive(null);
    setReady(true);
  }, [className, subject]);

  /** Ustunlar — chorak boshidan bugungacha shu sinf+fan darslari. */
  const columns = useMemo(() => {
    const term = termForDate(TODAY);
    if (!term) return [];
    const from = new Date(`${term.startsOn}T00:00:00`);
    const to = new Date(`${TODAY}T00:00:00`);
    return buildLessons(from, to)
      .filter((l) => l.className === className && l.subject === subject)
      .map((l) => ({ date: l.date, period: l.period }));
  }, [className, subject]);

  function put(studentId: string, date: string, value: number | null) {
    if (readOnly) return;
    const next = { ...book, [studentId]: { ...(book[studentId] ?? {}) } };
    if (value === null) {
      delete next[studentId][date];
      saveGrade(className, subject, studentId, date, null);
    } else {
      const entry: GradeEntry = { value, kind };
      next[studentId][date] = entry;
      saveGrade(className, subject, studentId, date, entry);
    }
    setBook(next);
  }

  // Klaviatura: katak tanlangan holda raqam bosish
  useEffect(() => {
    if (!active || readOnly) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        setActive(null);
        return;
      }
      if (scale === 5 && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        put(active!.studentId, active!.date, Number(e.key));
        setActive(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        put(active!.studentId, active!.date, null);
        setActive(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Tashqariga bosilsa yopiladi
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setActive(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />;
  }

  if (columns.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
        <p className="font-medium">Bu chorakda hali dars yoʻq</p>
        <p className="mt-1 text-sm text-foreground-muted">
          {className} sinfining {subject} fanidan darslar boshlanganda jurnal toʻladi.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Boshqaruv — faqat bitta tanlov qoldi: qanday baho qoʻyilyapti */}
      {readOnly ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" />
          </svg>
          <span>
            <span className="font-medium text-foreground">{subject}</span> — siz bu
            fandan dars bermaysiz. Sinf rahbari sifatida faqat koʻrasiz.
          </span>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground-muted">Baho turi:</span>
          <div className="flex rounded-lg border border-border bg-surface p-0.5">
            {(Object.keys(GRADE_KIND_LABELS) as GradeKind[])
              .filter((k) => GRADE_WEIGHTS[k] > 0)
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={`h-8 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    kind === k
                      ? "bg-brand text-brand-foreground"
                      : "text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {GRADE_KIND_LABELS[k]}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="border-collapse text-sm">
          <caption className="sr-only">
            {className} sinfining {subject} fanidan baholar jurnali
          </caption>
          <thead>
            <tr className="border-b border-border bg-surface-muted/60">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[190px] bg-surface-muted px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted"
              >
                Familiya, ism
              </th>
              {columns.map((c) => (
                <th
                  key={c.date}
                  scope="col"
                  className="min-w-[52px] px-1 py-2 text-center text-xs font-medium text-foreground-muted"
                >
                  <span className="block">{c.date.slice(8)}</span>
                  <span className="block text-[10px] font-normal opacity-70">
                    {c.date.slice(5, 7)}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="min-w-[64px] border-l border-border px-2 py-2 text-center text-xs font-medium text-foreground-muted"
              >
                Oʻrtacha
              </th>
              <th
                scope="col"
                className="min-w-[64px] px-2 py-2 text-center text-xs font-medium text-foreground-muted"
              >
                Chorak
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const row = book[s.studentId] ?? {};
              const avg = termAverage(row, scale);
              return (
                <tr key={s.studentId} className="border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 text-left font-normal"
                  >
                    {s.fullName}
                  </th>

                  {columns.map((c) => {
                    const g = row[c.date];
                    const isActive =
                      active?.studentId === s.studentId && active?.date === c.date;
                    return (
                      <td key={c.date} className="relative px-1 py-1.5 text-center">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() =>
                            setActive(isActive ? null : { studentId: s.studentId, date: c.date })
                          }
                          aria-label={`${s.fullName}, ${c.date}${g ? `: ${g.value}` : " — baho yoʻq"}`}
                          className={`h-8 w-8 rounded-lg text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
                            g
                              ? KIND_TONE[g.kind]
                              : "text-foreground-muted/40 hover:bg-surface-muted"
                          } ${isActive ? "ring-2 ring-brand" : ""} ${readOnly ? "cursor-default" : ""}`}
                        >
                          {g ? g.value : "·"}
                        </button>

                        {isActive && !readOnly && (
                          <GradePopover
                            boxRef={popRef}
                            scale={scale}
                            current={g?.value ?? null}
                            onPick={(v) => {
                              put(s.studentId, c.date, v);
                              setActive(null);
                            }}
                          />
                        )}
                      </td>
                    );
                  })}

                  <td className="border-l border-border px-2 py-1.5 text-center text-foreground-muted">
                    {avg ? avg.raw.toFixed(1) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {avg ? (
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                          scale === 5 && avg.rounded < 3
                            ? "bg-danger-tint text-danger"
                            : "bg-brand-tint text-brand-dark"
                        }`}
                      >
                        {avg.rounded}
                      </span>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <p className="mt-2.5 text-xs text-foreground-muted">
          Katakni bosing va <Kbd>1</Kbd>–<Kbd>5</Kbd> raqamini bosing.{" "}
          <Kbd>Backspace</Kbd> oʻchiradi, <Kbd>Esc</Kbd> yopadi. Chorak bahosi
          avtomatik hisoblanadi — nazorat ishi joriy bahodan uch barobar ogʻirroq.
        </p>
      )}
    </div>
  );
}

/* ---------- Baho tanlash oynachasi ---------- */

function GradePopover({
  boxRef,
  scale,
  current,
  onPick,
}: {
  // React 18 da `ref` oddiy prop boʻla olmaydi — boshqa nom bilan uzatiladi.
  boxRef: React.RefObject<HTMLDivElement>;
  scale: GradingScale;
  current: number | null;
  onPick: (value: number | null) => void;
}) {
  const values = scale === 5 ? [5, 4, 3, 2, 1] : [100, 90, 80, 70, 60, 50];

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Baho tanlash"
      className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 rounded-lg border border-border bg-surface p-1.5 shadow-lg"
    >
      <div className="flex gap-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className={`h-8 min-w-8 rounded-md px-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
              current === v
                ? "bg-brand text-brand-foreground"
                : "bg-surface-muted text-foreground hover:bg-brand-tint hover:text-brand-dark"
            }`}
          >
            {v}
          </button>
        ))}
        {current !== null && (
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-label="Bahoni oʻchirish"
            className="h-8 w-8 rounded-md text-sm text-danger transition-colors hover:bg-danger-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-[11px]">
      {children}
    </kbd>
  );
}
