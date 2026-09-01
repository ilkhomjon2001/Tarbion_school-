"use client";

import { useEffect, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { useChild } from "@/lib/parent/useChild";
import {
  fetchNotes,
  KIND_LABELS,
  TONE_LABELS,
  type WellbeingNoteOut,
} from "@/lib/wellbeing/api";

/**
 * Tarbiya va psixologiya — BAZADAN.
 *
 * Vasiy farzandi boʻyicha ikkala tur yozuvni ham koʻradi: tarbiyaviy
 * (ustozlar) va psixologik (rahbariyat). Begona bolaning yozuvi
 * serverda 403 bilan yopiq — bu yerda hech narsa filtrlanmaydi.
 */

const TONE_STYLES: Record<string, string> = {
  positive: "bg-success-tint text-success",
  neutral: "bg-surface-muted text-foreground-muted",
  attention: "bg-warning-tint text-warning",
};

export default function ParentWellbeingPage() {
  const [child, selectChild] = useChild();
  const [notes, setNotes] = useState<WellbeingNoteOut[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!child.id) return;
    let alive = true;
    setNotes(null);
    fetchNotes(child.id)
      .then((rows) => alive && setNotes(rows))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [child.id]);

  return (
    <ParentShell title="Tarbiya va psixologiya" child={child} onChildChange={selectChild}>
      <div className="flex flex-col gap-2">
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
          Bu yozuvlarni farzandingizning ustozlari va maktab mutaxassislari
          kiritadi. Savol tugʻilsa «Murojaat» boʻlimi orqali yozing.
        </p>

        {error ? (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
            Yozuvlarni olib boʻlmadi. Sahifani yangilab koʻring.
          </p>
        ) : notes === null ? (
          <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
        ) : notes.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
            Hozircha yozuv yoʻq — bu yaxshi belgi.
          </p>
        ) : (
          notes.map((n) => (
            <article
              key={n.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_STYLES[n.tone] ?? TONE_STYLES.neutral}`}
                  >
                    {TONE_LABELS[n.tone] ?? n.tone}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {KIND_LABELS[n.kind] ?? n.kind}
                  </span>
                </span>
                <span className="num text-xs text-foreground-muted">
                  {new Date(n.created_at).toLocaleDateString("uz-UZ")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{n.text}</p>
              <p className="mt-2 text-xs text-foreground-muted">
                {n.author_name}
                {n.subject_name && ` · ${n.subject_name} oʻqituvchisi`}
              </p>
            </article>
          ))
        )}
      </div>
    </ParentShell>
  );
}
