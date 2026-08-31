"use client";

import { useMemo, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { AppealThread } from "@/components/shared/AppealThread";
import { useTeacherMe } from "@/lib/teacher/me";
import { appealsAssignedTo, isOpen, type Appeal, type AppealTarget } from "@/lib/school/appeals";

type Filter = "all" | AppealTarget;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Barchasi" },
  { id: "homeroom", label: "Sinf rahbari sifatida" },
  { id: "subject_teacher", label: "Fan oʻqituvchisi sifatida" },
];

/**
 * Ustozga kelgan murojaatlar (MUR-01…MUR-06).
 *
 * Ikki rol bir sahifada: ustoz ham sinf rahbari, ham fan oʻqituvchisi
 * boʻlishi mumkin (lib/teacher/roles.ts ga qara) — filtr bilan ajratiladi.
 *
 * DEMO: faqat shu ustozga biriktirilgan murojaatlar koʻrsatiladi. Backend
 * ulanganda bu filtr SOʻROV darajasida boʻlishi shart (CLAUDE.md 7-qoida):
 * boshqa ustozning murojaatini koʻra olmaslik kerak.
 */
export default function TeacherAppealsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const me = useTeacherMe();
  const mine = useMemo<Appeal[]>(
    () => (me.user ? appealsAssignedTo(me.user.id) : []),
    [me.user],
  );

  const shown = filter === "all" ? mine : mine.filter((a) => a.target === filter);
  const openCount = mine.filter(isOpen).length;

  return (
    <TeacherShell
      title="Murojaatlar"
      subtitle={`Sizga kelgan ${mine.length} ta murojaat, ${openCount} tasi ochiq`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.id === "all" ? mine.length : mine.filter((a) => a.target === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                filter === f.id
                  ? "bg-brand text-brand-foreground"
                  : "border border-border text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {f.label} <span className="num opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Murojaat yoʻq</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Ota-onalardan xabar kelganda shu yerda koʻrinadi.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((appeal) => (
            <li key={appeal.id}>
              <AppealThread
                appeal={appeal}
                viewer="staff"
                viewerStaffId={me.user?.id ?? ""}
                defaultOpen={appeal.status === "new"}
              />
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}
