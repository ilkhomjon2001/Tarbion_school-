"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { getSubmissions, saveSubmissions } from "@/lib/teacher/store";
import {
  SUBMISSION_LABELS,
  type HomeworkItem,
  type SubmissionRow,
  type SubmissionStatus,
} from "@/lib/teacher/types";

/**
 * Uy vazifasini tekshirish va baholash (UYV-03, UYV-06).
 *
 * Tekshirilmagan ishlar birinchi — UYV-06 boʻyicha ustoz eng eskisidan
 * boshlaydi. Har bir ishga baho, izoh yoki "qayta ishlashga qaytarish".
 */

const STATUS_TONE: Record<SubmissionStatus, string> = {
  assigned: "bg-surface-muted text-foreground-muted",
  submitted: "bg-warning-tint text-warning",
  late: "bg-danger-tint text-danger",
  graded: "bg-success-tint text-success",
  returned: "bg-info-tint text-info",
};

type Filter = "pending" | "graded" | "missing" | "all";

export default function HomeworkReviewPage() {
  const params = useParams<{ id: string }>();

  const [homework, setHomework] = useState<HomeworkItem | null>(null);
  const [rows, setRows] = useState<SubmissionRow[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    getSubmissions(params.id).then((data) => {
      if (!alive) return;
      if (!data) {
        setNotFound(true);
        return;
      }
      setHomework(data.homework);
      setRows(data.rows);
    });
    return () => {
      alive = false;
    };
  }, [params.id]);

  const counts = useMemo(() => {
    const all = rows ?? [];
    return {
      pending: all.filter((r) => r.status === "submitted" || r.status === "late").length,
      graded: all.filter((r) => r.status === "graded").length,
      missing: all.filter((r) => r.status === "assigned").length,
      all: all.length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const all = rows ?? [];
    if (filter === "pending")
      return all.filter((r) => r.status === "submitted" || r.status === "late");
    if (filter === "graded") return all.filter((r) => r.status === "graded");
    if (filter === "missing") return all.filter((r) => r.status === "assigned");
    return all;
  }, [rows, filter]);

  function update(id: string, patch: Partial<SubmissionRow>) {
    setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));
    setDirty(true);
  }

  function grade(row: SubmissionRow, score: number) {
    update(row.id, { score, status: "graded" });
  }

  function returnForRework(row: SubmissionRow) {
    update(row.id, { status: "returned", score: null });
  }

  async function save() {
    if (!rows || saving) return;
    setSaving(true);
    await saveSubmissions(params.id, rows);
    setSaving(false);
    setDirty(false);
    setSavedAt(
      new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
    );
  }

  if (notFound) {
    return (
      <TeacherShell title="Vazifa topilmadi">
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="text-base font-medium">Bunday uy vazifasi mavjud emas</p>
          <Link
            href="/teacher/vazifa"
            className="mt-3 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand-dark"
          >
            Vazifalar roʻyxatiga qaytish
          </Link>
        </div>
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      title={homework ? homework.title : "Vazifani tekshirish"}
      subtitle={
        homework
          ? `${homework.className} · ${homework.subject} · Muddat: ${homework.dueAt}`
          : undefined
      }
      actions={
        <div className="flex items-center gap-3">
          {savedAt && !dirty && <span className="text-sm text-success">Saqlandi · {savedAt}</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saqlanmoqda…" : "Baholarni saqlash"}
          </button>
        </div>
      }
    >
      <Link
        href="/teacher/vazifa"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Uy vazifalari
      </Link>

      {homework && (
        <p className="mb-4 rounded-xl border border-border bg-surface p-4 text-sm text-foreground-muted">
          {homework.description}
        </p>
      )}

      {/* Filtr */}
      <div role="tablist" aria-label="Ishlarni filtrlash" className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["pending", "Tekshirilmagan", counts.pending],
            ["graded", "Baholangan", counts.graded],
            ["missing", "Topshirmagan", counts.missing],
            ["all", "Hammasi", counts.all],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === key
                ? "border-brand bg-brand-tint text-brand-dark"
                : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {label}
            <span className="rounded-full bg-surface-muted px-1.5 text-xs">{count}</span>
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="space-y-3" aria-busy="true" aria-label="Yuklanmoqda">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <p className="font-medium">
            {filter === "pending"
              ? "Tekshirilmagan ish qolmadi"
              : filter === "missing"
                ? "Hamma topshirgan"
                : "Bu boʻlimda ish yoʻq"}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{row.fullName}</p>
                  <p className="mt-0.5 text-xs text-foreground-muted">
                    {row.submittedAt ? `Topshirdi: ${row.submittedAt}` : "Hali topshirmagan"}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[row.status]}`}
                >
                  {SUBMISSION_LABELS[row.status]}
                </span>
              </div>

              {row.answerText && (
                <p className="mt-3 rounded-lg bg-surface-muted/60 px-3 py-2.5 text-sm">
                  {row.answerText}
                </p>
              )}
              {row.attachmentName && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-info">
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.19 5.19l-9.2 9.19a1.83 1.83 0 0 1-2.59-2.59l8.49-8.49" />
                  </svg>
                  {row.attachmentName}
                </p>
              )}

              {row.status !== "assigned" && homework && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    Baholash ({homework.maxScore} ballik)
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {Array.from({ length: homework.maxScore }, (_, i) => i + 1)
                      .filter((n) => homework.maxScore <= 5 || n % 20 === 0)
                      .map((score) => (
                        <button
                          key={score}
                          type="button"
                          aria-pressed={row.score === score}
                          onClick={() => grade(row, score)}
                          className={`h-10 w-10 rounded-lg border text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                            row.score === score
                              ? "border-brand bg-brand text-brand-foreground"
                              : "border-border bg-surface text-foreground-muted hover:border-brand hover:text-brand-dark"
                          }`}
                        >
                          {score}
                        </button>
                      ))}

                    <button
                      type="button"
                      onClick={() => returnForRework(row)}
                      className="ml-auto inline-flex h-10 items-center rounded-lg border border-info/40 px-3 text-sm font-medium text-info transition-colors hover:bg-info-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      Qayta ishlashga qaytarish
                    </button>
                  </div>

                  <label htmlFor={`c-${row.id}`} className="mt-3 mb-1.5 block text-sm font-medium">
                    Izoh
                  </label>
                  <textarea
                    id={`c-${row.id}`}
                    rows={2}
                    value={row.teacherComment ?? ""}
                    onChange={(e) => update(row.id, { teacherComment: e.target.value })}
                    placeholder="Oʻquvchiga izoh yozing…"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}
