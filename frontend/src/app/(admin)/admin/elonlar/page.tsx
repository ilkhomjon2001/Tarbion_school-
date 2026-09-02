"use client";

/**
 * Eʼlonlar (ADM-12) — administrator kabineti.
 *
 * Ustoznikidan farqi: «Butun maktab» auditoriyasi bor (backendda
 * `announcements.publish` huquqi tekshiriladi) va sinf/fan roʻyxati
 * jadval bilan cheklanmagan. Yuborishdan oldin qabul qiluvchilar soni
 * serverda hisoblanib koʻrsatiladi.
 */

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BellIcon } from "@/components/ui/icons";
import {
  AUDIENCE_LABELS,
  archiveAnnouncement,
  createAnnouncement,
  fetchAnnouncements,
  fetchTargets,
  previewRecipients,
  type AnnouncementOut,
  type TargetsOut,
} from "@/lib/announcements/api";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-base outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 sm:text-sm";

type Kind = "school" | "class" | "subject";

export default function AdminAnnouncementsPage() {
  const [targets, setTargets] = useState<TargetsOut | null>(null);
  const [items, setItems] = useState<AnnouncementOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<Kind>("school");
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

  useEffect(() => {
    if (!targets || kind === "school") {
      setTargetId("");
      return;
    }
    const list = kind === "class" ? targets.classes : targets.subjects;
    setTargetId(list[0]?.id ?? "");
  }, [kind, targets]);

  // ADM-12: tanlov oʻzgarishi bilan «nechta odamga ketadi» yangilanadi.
  useEffect(() => {
    if (kind !== "school" && !targetId) {
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

  const options =
    kind === "class" ? (targets?.classes ?? []) : (targets?.subjects ?? []);
  const valid =
    title.trim().length >= 2 &&
    body.trim().length >= 2 &&
    (kind === "school" || targetId !== "");

  async function yubor(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
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
      setError("Eʼlonni yuborib boʻlmadi. Huquqingizni tekshiring.");
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
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Eʼlonlar</h1>
        <p className="text-sm text-foreground-muted">
          Butun maktabga, sinfga yoki fan boʻyicha oilalarga xabar
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={yubor}
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
      >
        <div className="flex flex-wrap gap-2">
          {(["school", "class", "subject"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={`focus-ring rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                kind === k
                  ? "border-brand bg-brand-tint text-brand-dark"
                  : "border-border text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {AUDIENCE_LABELS[k] ?? k}
            </button>
          ))}
        </div>

        {kind !== "school" && (
          <label className="block sm:max-w-xs">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              {kind === "class" ? "Qaysi sinfga" : "Qaysi fandan"}
            </span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={inputClass}
            >
              {options.length === 0 && <option value="">Roʻyxat boʻsh</option>}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Sarlavha</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 160))}
            placeholder="Masalan, Ota-onalar yigʻilishi"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Matn</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            rows={4}
            placeholder="Eʼlon matni…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 sm:text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={important}
            onChange={(e) => setImportant(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          Muhim eʼlon sifatida belgilash
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm text-foreground-muted">
            {recipients !== null && (
              <>
                Qabul qiladi:{" "}
                <span className="num font-semibold text-foreground">{recipients}</span>{" "}
                kishi
              </>
            )}
          </p>
          <button
            type="submit"
            disabled={!valid || busy}
            className="focus-ring inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50 sm:h-10"
          >
            {busy ? "Yuborilmoqda…" : "Eʼlonni yuborish"}
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Berilgan eʼlonlar</h2>
        {items === null ? (
          <ListSkeleton count={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellIcon className="h-5 w-5" />}
            title="Hali eʼlon yoʻq"
            description="Birinchi eʼlonni yuqoridagi forma orqali bering."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground-muted">
                    {AUDIENCE_LABELS[a.audience] ?? a.audience}
                    {a.subject_name ? ` · ${a.subject_name}` : ""}
                    {a.class_names?.length ? ` · ${a.class_names.join(", ")}` : ""}
                  </span>
                  {a.important && (
                    <span className="rounded-full bg-danger-tint px-2 py-0.5 text-[11px] font-semibold text-danger">
                      Muhim
                    </span>
                  )}
                  <span className="num ml-auto text-xs text-foreground-muted">
                    {a.recipients_count} kishi
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{a.title}</p>
                <p className="text-sm text-foreground-muted">{a.body}</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void olibTashla(a.id)}
                    className="focus-ring rounded px-1.5 py-1 text-xs font-medium text-foreground-muted hover:text-danger"
                  >
                    Olib tashlash
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
