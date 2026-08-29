"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { getHomeworkList } from "@/lib/teacher/store";
import type { HomeworkItem } from "@/lib/teacher/types";

/**
 * Uy vazifalari roʻyxati (UYV-01, UYV-06).
 *
 * Tekshirilmagan ishi bor vazifalar tepada — ustoz avval nimani
 * tekshirishini izlab yurmasin.
 */
export default function HomeworkListPage() {
  const [items, setItems] = useState<HomeworkItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let alive = true;
    getHomeworkList().then((data) => {
      if (!alive) return;
      const sorted = [...data].sort(
        (a, b) =>
          b.submittedCount - b.gradedCount - (a.submittedCount - a.gradedCount),
      );
      setItems(sorted);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pendingTotal =
    items?.reduce((sum, h) => sum + (h.submittedCount - h.gradedCount), 0) ?? 0;

  return (
    <TeacherShell
      title="Uy vazifasi"
      subtitle={
        items === null
          ? undefined
          : pendingTotal > 0
            ? `${pendingTotal} ta ish tekshirilmagan`
            : "Barcha ishlar tekshirilgan"
      }
      actions={
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yangi vazifa berish
        </button>
      }
    >
      {showForm && <NewHomeworkForm onClose={() => setShowForm(false)} />}

      {items === null ? (
        <div className="space-y-3" aria-busy="true" aria-label="Yuklanmoqda">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="text-base font-medium">Hali vazifa berilmagan</p>
          <p className="mt-1 text-sm text-foreground-muted">
            &ldquo;Yangi vazifa berish&rdquo; tugmasi orqali birinchi vazifani qoʻshing.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((hw) => {
            const pending = hw.submittedCount - hw.gradedCount;
            return (
              <li key={hw.id}>
                <Link
                  href={`/teacher/vazifa/${hw.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-surface-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand-dark">
                          {hw.className}
                        </span>
                        <span className="text-xs text-foreground-muted">{hw.subject}</span>
                      </div>
                      <p className="mt-1.5 font-medium">{hw.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-foreground-muted">
                        {hw.description}
                      </p>
                    </div>

                    {pending > 0 ? (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-warning-tint px-2.5 py-1 text-xs font-medium text-warning">
                        {pending} ta tekshirilmagan
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-success-tint px-2.5 py-1 text-xs font-medium text-success">
                        Tekshirilgan
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground-muted">
                    <span>
                      Muddat: <span className="text-foreground">{hw.dueAt}</span>
                    </span>
                    <span>
                      Topshirdi:{" "}
                      <span className="text-foreground">
                        {hw.submittedCount}/{hw.totalCount}
                      </span>
                    </span>
                    <span>
                      Baholandi:{" "}
                      <span className="text-foreground">
                        {hw.gradedCount}/{hw.totalCount}
                      </span>
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-valuenow={hw.gradedCount}
                    aria-valuemin={0}
                    aria-valuemax={hw.totalCount}
                    aria-label={`${hw.title} — baholangan ishlar`}
                    className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                  >
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${(hw.gradedCount / hw.totalCount) * 100}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </TeacherShell>
  );
}

/** UYV-01: ustoz uy vazifasini beradi — matn, muddat, maksimal ball. */
function NewHomeworkForm({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Demo: backend ulanmagan, faqat tasdiq koʻrsatiladi.
    setSaved(true);
    setTimeout(onClose, 1400);
  }

  if (saved) {
    return (
      <div
        role="status"
        className="mb-4 rounded-xl border border-success/30 bg-success-tint px-4 py-3 text-sm text-success"
      >
        Vazifa berildi. Oʻquvchilarga bildirishnoma yuboriladi.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-5 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-sm font-semibold">Yangi uy vazifasi</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Sinf" htmlFor="hw-class">
          <select
            id="hw-class"
            defaultValue="11-A"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <option>11-A</option>
            <option>10-A</option>
            <option>9-B</option>
          </select>
        </Field>

        <Field label="Fan" htmlFor="hw-subject">
          <select
            id="hw-subject"
            defaultValue="Algebra"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <option>Algebra</option>
            <option>Geometriya</option>
            <option>Matematika</option>
          </select>
        </Field>

        <Field label="Sarlavha" htmlFor="hw-title" full>
          <input
            id="hw-title"
            required
            placeholder="Masalan: Kvadrat tenglamalar — 6-mashq"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </Field>

        <Field label="Tavsif" htmlFor="hw-desc" full>
          <textarea
            id="hw-desc"
            rows={3}
            placeholder="Vazifa shartini yozing…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </Field>

        <Field label="Topshirish muddati" htmlFor="hw-due">
          <input
            id="hw-due"
            type="date"
            required
            defaultValue="2026-09-05"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </Field>

        <Field label="Baholash tizimi" htmlFor="hw-scale">
          <select
            id="hw-scale"
            defaultValue="5"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <option value="5">5 ballik</option>
            <option value="100">100 ballik</option>
          </select>
        </Field>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Vazifani berish
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
