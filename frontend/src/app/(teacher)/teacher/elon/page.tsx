"use client";

import { useCallback, useEffect, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import {
  archiveAnnouncement,
  AUDIENCE_LABELS,
  createAnnouncement,
  fetchAnnouncements,
  fetchTargets,
  previewRecipients,
  type AnnouncementOut,
  type TargetsOut,
} from "@/lib/announcements/api";

/**
 * Eʼlonlar (T-020, ADM-12) — BAZADAN.
 *
 * Ustoz eʼlonni ikki auditoriyaga bera oladi:
 *   sinf — oʻzi dars beradigan yoki rahbarlik qiladigan sinfga;
 *   fan  — oʻsha fandan dars beradigan barcha sinflariga.
 *
 * Yuborishdan OLDIN qabul qiluvchilar soni koʻrsatiladi (ADM-12) va bu
 * son serverda hisoblanadi: haqiqiy adresatlar `guardians` jadvalidan
 * chiqadi. «Butun maktab» varianti bu yerda ataylab YOʻQ — u
 * `announcements.publish` huquqini talab qiladi va administratorniki.
 */

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

export default function AnnouncementsPage() {
  const [targets, setTargets] = useState<TargetsOut | null>(null);
  const [items, setItems] = useState<AnnouncementOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<"class" | "subject">("class");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [recipients, setRecipients] = useState<number | null>(null);

  const yukla = useCallback(async () => {
    try {
      const [t, list] = await Promise.all([fetchTargets(), fetchAnnouncements()]);
      setTargets(t);
      setItems(list);
      setError(null);
    } catch {
      setError("Maʼlumotni olib boʻlmadi. Sahifani yangilab koʻring.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  // Auditoriya oʻzgarsa birinchi variantni tanlaymiz.
  useEffect(() => {
    if (!targets) return;
    const list = kind === "class" ? targets.classes : targets.subjects;
    setTargetId(list[0]?.id ?? "");
  }, [kind, targets]);

  // ADM-12: tanlov oʻzgarishi bilan «nechta odamga ketadi» yangilanadi.
  useEffect(() => {
    if (!targetId) {
      setRecipients(null);
      return;
    }
    let alive = true;
    previewRecipients(kind, targetId)
      .then((n) => alive && setRecipients(n))
      .catch(() => alive && setRecipients(null));
    return () => {
      alive = false;
    };
  }, [kind, targetId]);

  const options = kind === "class" ? (targets?.classes ?? []) : (targets?.subjects ?? []);
  const valid = title.trim().length >= 2 && body.trim().length >= 2 && targetId !== "";

  async function yubor(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await createAnnouncement({
        audience: kind,
        targetId,
        title: title.trim(),
        body: body.trim(),
        important,
      });
      setTitle("");
      setBody("");
      setImportant(false);
      await yukla();
    } catch {
      setError("Eʼlonni yuborib boʻlmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function olibTashla(id: string) {
    setBusy(true);
    try {
      await archiveAnnouncement(id);
      await yukla();
    } catch {
      setError("Olib tashlab boʻlmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell title="Eʼlonlar" subtitle="Sinf yoki fan boʻyicha oilalarga xabar">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <form
          onSubmit={yubor}
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex flex-wrap gap-2">
            {(["class", "subject"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`focus-ring rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  kind === k
                    ? "border-brand bg-brand/10 text-brand-dark"
                    : "border-border text-foreground-muted hover:bg-surface-muted"
                }`}
              >
                {AUDIENCE_LABELS[k]}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              {kind === "class" ? "Qaysi sinfga" : "Qaysi fandan"}
            </span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={inputClass}
            >
              {options.length === 0 && <option value="">Jadvalingizda yoʻq</option>}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sarlavha</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 160))}
              placeholder="Masalan, Ertaga nazorat ishi"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Matn</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 4000))}
              rows={4}
              placeholder="Eʼlon matni…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={important}
              onChange={(e) => setImportant(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand,#2563eb)]"
            />
            Muhim eʼlon sifatida belgilash
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground-muted">
              {recipients === null ? (
                "Qabul qiluvchilar hisoblanmoqda…"
              ) : (
                <>
                  <span className="num font-semibold text-foreground">{recipients}</span>{" "}
                  kishiga yetkaziladi (ota-ona va oʻquvchi hisoblari)
                </>
              )}
            </p>
            <button
              type="submit"
              disabled={!valid || busy}
              className="focus-ring inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              Eʼlonni yuborish
            </button>
          </div>
        </form>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Mening eʼlonlarim</h2>
          {items === null ? (
            <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
              Hali eʼlon bermagansiz.
            </p>
          ) : (
            items.map((a) => (
              <article
                key={a.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">
                      {a.important && <span className="mr-1.5 text-danger">!</span>}
                      {a.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-foreground-muted">
                      {a.class_names.length > 0 ? a.class_names.join(", ") : AUDIENCE_LABELS[a.audience]}
                      {a.subject_name && ` · ${a.subject_name}`} ·{" "}
                      <span className="num">{a.recipients_count}</span> kishiga ·{" "}
                      {new Date(a.created_at).toLocaleDateString("uz-UZ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void olibTashla(a.id)}
                    className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger disabled:opacity-40"
                  >
                    Olib tashlash
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{a.body}</p>
              </article>
            ))
          )}
        </section>
      </div>
    </TeacherShell>
  );
}
