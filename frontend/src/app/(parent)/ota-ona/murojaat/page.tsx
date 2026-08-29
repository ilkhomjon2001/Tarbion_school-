"use client";

import { useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_TOPICS,
  APPEALS,
  TODAY,
  type AppealItem,
} from "@/lib/parent/data";
import { useChild } from "@/lib/parent/useChild";

/**
 * Murojaatlar (OTA-07, MUR-01…MUR-04).
 *
 * Vasiy murojaat yuboradi, mavzuga qarab masʼulga yoʻnaltiriladi va
 * holati kuzatiladi. Javob berish muddati koʻrsatiladi (MUR-04) —
 * muddati oʻtgani ajratib beriladi, chunki javobsiz qolgan murojaat
 * ota-onaning eng koʻp shikoyat qiladigan narsasi.
 */

const STATUS_TONE: Record<AppealItem["status"], string> = {
  new: "bg-surface-muted text-foreground-muted",
  in_review: "bg-warning-tint text-warning",
  answered: "bg-success-tint text-success",
  closed: "bg-surface-muted text-foreground-muted",
};

export default function ParentAppealsPage() {
  const [child, setChild] = useChild();
  const [items, setItems] = useState<AppealItem[]>(APPEALS);
  const [showForm, setShowForm] = useState(false);

  function submit(a: AppealItem) {
    setItems((prev) => [a, ...prev]);
    setShowForm(false);
  }

  const waiting = items.filter((a) => a.status === "new" || a.status === "in_review").length;

  return (
    <ParentShell title="Murojaat" child={child} onChildChange={setChild}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-muted">
          {waiting > 0 ? `${waiting} ta murojaat javob kutmoqda` : "Javob kutayotgan murojaat yoʻq"}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yangi murojaat
        </button>
      </div>

      {showForm && <AppealForm onSubmit={submit} onCancel={() => setShowForm(false)} />}

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="font-medium">Hali murojaat yubormagansiz</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-foreground-muted">
            Davomat, baho yoki toʻlov boʻyicha savolingiz boʻlsa — shu yerdan
            yozing, javob kabinetda va Telegramda keladi.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const overdue =
              (a.status === "new" || a.status === "in_review") && a.dueAt < TODAY;
            return (
              <li
                key={a.id}
                className={`rounded-xl border bg-surface p-4 ${
                  overdue ? "border-danger/40" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand-dark">
                        {a.topic}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[a.status]}`}
                      >
                        {APPEAL_STATUS_LABELS[a.status]}
                      </span>
                      {overdue && (
                        <span className="rounded-full bg-danger-tint px-2.5 py-0.5 text-xs font-medium text-danger">
                          Muddati oʻtgan
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{a.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-foreground-muted">{a.createdAt}</span>
                </div>

                <p className="mt-2.5 text-xs text-foreground-muted">
                  Masʼul: {a.assignee} · Javob muddati: {a.dueAt}
                </p>

                {a.answer && (
                  <div className="mt-3 rounded-lg border-l-[3px] border-success bg-success-tint/50 px-3 py-2.5">
                    <p className="text-xs font-medium text-success">
                      Javob · {a.answeredAt}
                    </p>
                    <p className="mt-1 text-sm">{a.answer}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </ParentShell>
  );
}

/** MUR-01: mavzu turi, matn, ixtiyoriy fayl. */
function AppealForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (a: AppealItem) => void;
  onCancel: () => void;
}) {
  const [topic, setTopic] = useState(APPEAL_TOPICS[0]);
  const [body, setBody] = useState("");

  /** MUR-02: mavzuga qarab masʼul aniqlanadi. */
  const assignee =
    topic === "Toʻlov boʻyicha"
      ? "Maktab administratsiyasi"
      : topic === "Dars jadvali"
        ? "Maktab administratsiyasi"
        : "Aliyev S. — sinf rahbari";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim().length < 10) return;
        onSubmit({
          id: `m-${Date.now()}`,
          topic,
          body: body.trim(),
          createdAt: new Date().toLocaleString("uz-UZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: "new",
          assignee,
          dueAt: "2026-09-02",
        });
      }}
      className="mb-4 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-sm font-semibold">Yangi murojaat</h2>

      <div className="mt-3">
        <label htmlFor="ap-topic" className="mb-1.5 block text-sm font-medium">
          Mavzu
        </label>
        <select
          id="ap-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        >
          {APPEAL_TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {/* MUR-02: kimga borishi oldindan koʻrinadi */}
        <p className="mt-1.5 text-xs text-foreground-muted">
          Bu murojaat <span className="font-medium text-foreground">{assignee}</span> ga
          yoʻnaltiriladi.
        </p>
      </div>

      <div className="mt-3">
        <label htmlFor="ap-body" className="mb-1.5 block text-sm font-medium">
          Murojaat matni
        </label>
        <textarea
          id="ap-body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Savolingizni yoki taklifingizni yozing…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        />
      </div>

      <div className="mt-3">
        <label htmlFor="ap-file" className="mb-1.5 block text-sm font-medium">
          Fayl (ixtiyoriy)
        </label>
        <input
          id="ap-file"
          type="file"
          accept="image/*,.pdf"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={body.trim().length < 10}
          className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          Yuborish
        </button>
      </div>
    </form>
  );
}
