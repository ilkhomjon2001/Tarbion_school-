"use client";

import { useEffect, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { messageOf } from "@/components/shared/LiveSession";
import { formatDateTime } from "@/lib/format";
import { SUBMISSION_LABELS, type SubmissionStatus } from "@/lib/contracts";
import { useChild } from "@/lib/parent/useChild";
import { fetchHomeworkList } from "@/lib/student/api";
import type { Homework } from "@/lib/types";

/**
 * Uy vazifasi holati (OTA-05) — BAZADAN. Ilgari «Baholar» sahifasida
 * ichki yorliq edi; egasining soʻrovi bilan alohida boʻlim qilindi.
 *
 * Maʼlumot qatlami oʻquvchi kabineti bilan UMUMIY (`lib/student/api.ts`):
 * kim qaysi oʻquvchini koʻrishini server hal qiladi (X-1) — bu yerda
 * faqat farzand tanlanadi.
 */

const HW_TONES: Record<SubmissionStatus, string> = {
  assigned: "bg-surface-muted text-foreground-muted",
  submitted: "bg-info-tint text-info",
  late: "bg-warning-tint text-warning",
  graded: "bg-success-tint text-success",
  returned: "bg-danger-tint text-danger",
};

const FILTERS: { key: SubmissionStatus | "all"; label: string }[] = [
  { key: "all", label: "Barchasi" },
  { key: "assigned", label: SUBMISSION_LABELS.assigned },
  { key: "submitted", label: SUBMISSION_LABELS.submitted },
  { key: "graded", label: SUBMISSION_LABELS.graded },
  { key: "late", label: SUBMISSION_LABELS.late },
];

export default function ParentHomeworkPage() {
  const [child, setChild] = useChild();
  const [items, setItems] = useState<Homework[] | null>(null);
  const [filter, setFilter] = useState<SubmissionStatus | "all">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!child.id) return;
    let alive = true;
    setItems(null);
    setError("");
    void (async () => {
      try {
        const hw = await fetchHomeworkList(child.id);
        if (alive) setItems(hw);
      } catch (err) {
        if (alive) setError(messageOf(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [child.id]);

  const filtered =
    filter === "all" ? (items ?? []) : (items ?? []).filter((h) => h.status === filter);
  const pending = (items ?? []).filter(
    (h) => h.status === "assigned" || h.status === "late",
  ).length;

  return (
    <ParentShell title="Uy vazifasi" child={child} onChildChange={setChild}>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mb-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-foreground-muted">
          Topshirilmagan vazifa
        </p>
        <p
          className={`num mt-1 text-3xl font-bold ${
            items === null
              ? "text-foreground-muted"
              : pending > 0
                ? "text-warning"
                : "text-success"
          }`}
        >
          {items === null ? "—" : pending}
        </p>
        <p className="mt-0.5 text-sm text-foreground-muted">
          {items === null
            ? ""
            : pending > 0
              ? "Muddati oʻtmasidan topshirsin"
              : "Hammasi topshirilgan"}
        </p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Holat boʻyicha saralash">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`h-10 shrink-0 rounded-lg border px-3.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === key
                ? "border-brand bg-brand-tint text-brand-dark"
                : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-foreground-muted">
          {items.length === 0
            ? "Hozircha uy vazifasi berilmagan."
            : "Bu holatda vazifa yoʻq."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((h) => (
            <li key={h.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-foreground-muted">{h.subject}</p>
                  <p className="mt-0.5 font-medium">{h.title}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${HW_TONES[h.status]}`}
                >
                  {SUBMISSION_LABELS[h.status]}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground-muted">
                <span>
                  Muddat:{" "}
                  <span className="text-foreground">{formatDateTime(h.dueDate)}</span>
                </span>
                {h.grade !== undefined && (
                  <span>
                    Baho: <span className="font-semibold text-success">{h.grade}</span>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ParentShell>
  );
}
