"use client";

import { useEffect, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { useChild } from "@/lib/parent/useChild";
import {
  AUDIENCE_LABELS,
  fetchAnnouncements,
  type AnnouncementOut,
} from "@/lib/announcements/api";

/**
 * Eʼlonlar (OTA-08) — BAZADAN (T-020).
 *
 * Roʻyxat serverda kesilgan: butun maktab eʼlonlari va farzand(lar)ining
 * sinfiga tegishlilari. Bir necha farzand boʻlsa hammasining sinf
 * eʼlonlari birga keladi — qaysi sinfga tegishli ekani tegda koʻrinadi.
 */
export default function ParentNewsPage() {
  const [child, selectChild] = useChild();
  const [items, setItems] = useState<AnnouncementOut[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAnnouncements()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ParentShell title="Eʼlonlar" child={child} onChildChange={selectChild}>
      <div className="flex flex-col gap-2">
        {error ? (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            Eʼlonlarni olib boʻlmadi. Sahifani yangilab koʻring.
          </p>
        ) : items === null ? (
          <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
            Hozircha eʼlon yoʻq.
          </p>
        ) : (
          items.map((a) => {
            const ochiq = open === a.id;
            return (
              <article
                key={a.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpen(ochiq ? null : a.id)}
                  aria-expanded={ochiq}
                  className="focus-ring flex w-full items-start justify-between gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">
                      {a.important && <span className="mr-1.5 text-danger">!</span>}
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-foreground-muted">
                      {a.class_names.length > 0
                        ? a.class_names.join(", ")
                        : AUDIENCE_LABELS[a.audience]}
                      {a.subject_name && ` · ${a.subject_name}`} · {a.author_name}
                    </span>
                  </span>
                  <span className="num shrink-0 text-xs text-foreground-muted">
                    {new Date(a.created_at).toLocaleDateString("uz-UZ")}
                  </span>
                </button>
                {ochiq && (
                  <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-foreground">
                    {a.body}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </ParentShell>
  );
}
