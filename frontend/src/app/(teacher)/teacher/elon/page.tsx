"use client";

import { useEffect, useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { DEMO_LESSONS } from "@/lib/teacher/data";
import { classColor } from "@/lib/teacher/schedule";
import { loadCollection, saveCollection } from "@/lib/teacher/store";
import {
  DEMO_ANNOUNCEMENTS,
  type Announcement,
  type AudienceKind,
} from "@/lib/teacher/school-data";

/**
 * Eʼlonlar (ADM-12, BOT-04).
 *
 * Ustoz eʼlonni ikki auditoriyaga bera oladi:
 *   sinf  — oʻzi dars beradigan yoki rahbarlik qiladigan sinfga
 *   fan   — oʻsha fandan dars beradigan barcha sinflarga
 *
 * Yuborishdan OLDIN qabul qiluvchilar soni koʻrsatiladi — ADM-12 ning
 * qabul mezoni. Ustoz "21 kishiga ketadi" deb bilib turib bosadi.
 */

/** Ustozning sinflari va fanlari — jadvaldan olinadi. */
const MY_CLASSES = Array.from(new Set(DEMO_LESSONS.map((l) => l.className)));
const MY_SUBJECTS = Array.from(new Set(DEMO_LESSONS.map((l) => l.subject)));

/** Sinfdagi vasiylar soni (demo). Backendda `guardians` dan hisoblanadi. */
const CLASS_RECIPIENTS: Record<string, number> = {
  "11-A": 21,
  "9-B": 18,
  "10-A": 19,
};

function recipientsFor(kind: AudienceKind, target: string): number {
  if (kind === "class") return CLASS_RECIPIENTS[target] ?? 0;
  // Fan boʻyicha — shu fandan dars beradigan barcha sinflar
  return DEMO_LESSONS.filter((l) => l.subject === target)
    .map((l) => l.className)
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .reduce((sum, c) => sum + (CLASS_RECIPIENTS[c] ?? 0), 0);
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>(DEMO_ANNOUNCEMENTS);

  useEffect(() => {
    setItems(loadCollection("announcements", DEMO_ANNOUNCEMENTS));
  }, []);
  const [showForm, setShowForm] = useState(false);

  function publish(a: Announcement) {
    const next = [a, ...items];
    setItems(next);
    saveCollection("announcements", next);
    setShowForm(false);
  }

  return (
    <TeacherShell
      title="Eʼlonlar"
      subtitle={`${items.length} ta eʼlon yuborilgan`}
      actions={
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yangi eʼlon
        </button>
      }
    >
      {showForm && <AnnouncementForm onPublish={publish} onCancel={() => setShowForm(false)} />}

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="text-base font-medium">Hali eʼlon berilmagan</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Sinf yoki fan boʻyicha birinchi eʼloningizni yuboring.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li
              key={a.id}
              className={`rounded-xl border bg-surface p-4 ${
                a.important ? "border-warning/40" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.kind === "class" ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classColor(a.target).block}`}
                      >
                        {a.target}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
                        {a.target} · barcha sinflar
                      </span>
                    )}
                    {a.important && (
                      <span className="inline-flex items-center rounded-full bg-warning-tint px-2.5 py-0.5 text-xs font-medium text-warning">
                        Muhim
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-medium">{a.title}</p>
                </div>

                <span className="shrink-0 text-xs text-foreground-muted">{a.createdAt}</span>
              </div>

              <p className="mt-2 text-sm text-foreground-muted">{a.body}</p>

              <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-foreground-muted">
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12l5 5L20 6" />
                </svg>
                {a.recipients} ta vasiyga yetkazildi · kabinetda va Telegramda koʻrinadi
              </p>
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}

/** ADM-12: auditoriya tanlanadi va qabul qiluvchilar soni oldindan koʻrsatiladi. */
function AnnouncementForm({
  onPublish,
  onCancel,
}: {
  onPublish: (a: Announcement) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<AudienceKind>("class");
  const [target, setTarget] = useState(MY_CLASSES[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const options = kind === "class" ? MY_CLASSES : MY_SUBJECTS;
  const recipients = useMemo(() => recipientsFor(kind, target), [kind, target]);
  const valid = title.trim().length > 2 && body.trim().length > 5;

  function switchKind(next: AudienceKind) {
    setKind(next);
    setTarget(next === "class" ? MY_CLASSES[0] : MY_SUBJECTS[0]);
    setConfirming(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    // Yuborishdan oldin bir marta tasdiqlash — eʼlon qaytarib olinmaydi.
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onPublish({
      id: `a-${Date.now()}`,
      kind,
      target,
      title: title.trim(),
      body: body.trim(),
      createdAt: new Date().toLocaleString("uz-UZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      recipients,
      important,
    });
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Yangi eʼlon</h2>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-medium">Kimga yuboriladi</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["class", "Sinfga"],
              ["subject", "Fan boʻyicha barcha sinflarga"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => switchKind(k)}
              className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                kind === k
                  ? "border-brand bg-brand-tint text-brand-dark"
                  : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="an-target" className="mb-1.5 block text-sm font-medium">
            {kind === "class" ? "Sinf" : "Fan"}
          </label>
          <select
            id="an-target"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setConfirming(false);
            }}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={important}
              onChange={(e) => setImportant(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[var(--color-brand)]"
            />
            Muhim deb belgilash
          </label>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="an-title" className="mb-1.5 block text-sm font-medium">
            Sarlavha
          </label>
          <input
            id="an-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setConfirming(false);
            }}
            placeholder="Masalan: Ota-onalar majlisi — 5-sentabr"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="an-body" className="mb-1.5 block text-sm font-medium">
            Matn
          </label>
          <textarea
            id="an-body"
            rows={4}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setConfirming(false);
            }}
            placeholder="Eʼlon matnini yozing…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
      </div>

      {/* ADM-12: yuborishdan oldin qabul qiluvchilar soni */}
      <div
        className={`mt-3 rounded-lg px-3 py-2.5 text-sm ${
          confirming ? "bg-warning-tint text-warning" : "bg-surface-muted text-foreground-muted"
        }`}
      >
        {confirming ? (
          <>
            <span className="font-medium">Tasdiqlang.</span> Eʼlon{" "}
            <span className="font-medium">{recipients} ta vasiyga</span> yuboriladi
            va qaytarib olinmaydi. Yuborish uchun tugmani yana bosing.
          </>
        ) : (
          <>
            Bu eʼlon <span className="font-medium text-foreground">{recipients} ta vasiyga</span>{" "}
            yetib boradi — kabinetda va Telegram orqali.
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirming ? `Ha, ${recipients} kishiga yuborish` : "Eʼlonni yuborish"}
        </button>
      </div>
    </form>
  );
}
