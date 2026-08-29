"use client";

import { useState } from "react";
import { ParentShell } from "@/components/parent/ParentShell";
import { useChild } from "@/lib/parent/useChild";
import { HOMEROOM } from "@/lib/school/staff";
import {
  authorRoleLabel,
  noteAuthor,
  notesFor,
  TONE_LABELS,
  type WellbeingKind,
  type WellbeingNote,
  type WellbeingTone,
} from "@/lib/school/wellbeing";

const TABS: { id: WellbeingKind; label: string; hint: string }[] = [
  {
    id: "behavior",
    label: "Tarbiyaviy holat",
    hint: "Sinf rahbari va fan oʻqituvchilari kiritadi",
  },
  {
    id: "psychology",
    label: "Psixologik holat",
    hint: "Maktab psixologi kiritadi",
  },
];

const TONE_CLASSES: Record<WellbeingTone, string> = {
  positive: "border-l-success bg-success-tint/40",
  neutral: "border-l-info bg-info-tint/40",
  attention: "border-l-warning bg-warning-tint/40",
};

const TONE_TEXT: Record<WellbeingTone, string> = {
  positive: "text-success",
  neutral: "text-info",
  attention: "text-warning",
};

/**
 * Tarbiyaviy va psixologik holat.
 *
 * TZ'da bu boʻlim yoʻq — loyiha egasining soʻrovi bilan qoʻshildi
 * (docs/DECISIONS.md). Maʼlumot nozik: backendda faqat vasiy, sinf
 * rahbari, psixolog va rahbariyat koʻra olishi soʻrov darajasida
 * cheklanishi shart (CLAUDE.md 6-qoida).
 */
export default function ParentWellbeingPage() {
  const [child, setChild] = useChild();
  const [tab, setTab] = useState<WellbeingKind>("behavior");

  const notes = notesFor(child.id, tab);
  const homeroomId = HOMEROOM[child.className] ?? null;
  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <ParentShell title="Tarbiya va psixologiya" child={child} onChildChange={setChild}>
      <div role="tablist" aria-label="Boʻlimlar" className="mb-3 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              tab === t.id
                ? "border-brand text-brand-dark"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-foreground-muted">{activeTab.hint}</p>

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Hozircha yozuv yoʻq</p>
          <p className="mt-1 text-sm text-foreground-muted">
            {tab === "behavior"
              ? "Sinf rahbari yoki fan oʻqituvchisi izoh qoldirganda shu yerda koʻrinadi."
              : "Psixolog suhbatdan keyin xulosa qoldirsa shu yerda koʻrinadi."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} homeroomId={homeroomId} />
          ))}
        </ul>
      )}
    </ParentShell>
  );
}

function NoteCard({ note, homeroomId }: { note: WellbeingNote; homeroomId: string | null }) {
  const author = noteAuthor(note);
  return (
    <li className={`rounded-xl border border-border border-l-4 p-4 ${TONE_CLASSES[note.tone]}`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-foreground-muted">
            {author?.initials ?? "?"}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{author?.fullName ?? "Xodim"}</p>
            <p className="text-xs text-foreground-muted">
              {authorRoleLabel(note, homeroomId)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xs font-medium ${TONE_TEXT[note.tone]}`}>
            {TONE_LABELS[note.tone]}
          </p>
          <p className="text-[11px] text-foreground-muted">{note.createdAt}</p>
        </div>
      </div>
      <p className="text-sm text-foreground">{note.text}</p>
    </li>
  );
}
