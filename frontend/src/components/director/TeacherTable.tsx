"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlusIcon } from "@/components/ui/icons";
import type { Teacher } from "@/lib/director/types";

export function TeacherTable({
  initialTeachers,
  subjects,
}: {
  initialTeachers: Teacher[];
  subjects: string[];
}) {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ fullName: "", subject: subjects[0] ?? "", homeroom: "" });

  const filtered = useMemo(() => {
    if (!subjectFilter) return teachers;
    return teachers.filter((t) => t.subjects.includes(subjectFilter));
  }, [teachers, subjectFilter]);

  function addTeacher() {
    if (!draft.fullName.trim()) return;
    const id = `t-new-${Date.now()}`;
    const short = draft.fullName.trim().split(" ").slice(0, 2).join(" ");
    setTeachers((prev) => [
      {
        id,
        fullName: draft.fullName.trim(),
        shortName: short,
        subjects: draft.subject ? [draft.subject] : [],
        homeroomClassName: draft.homeroom.trim() || null,
        weeklyLoadHours: 0,
        status: "active",
        phone: "—",
        email: "—",
        avatarInitials: initials(draft.fullName),
      },
      ...prev,
    ]);
    setDraft({ fullName: "", subject: subjects[0] ?? "", homeroom: "" });
    setAdding(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Ustozlar roʻyxati</h1>
          <p className="text-sm text-foreground-muted">
            Maktabdagi barcha oʻqituvchilarni boshqarish va kuzatish
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Fan boʻyicha filtr"
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <option value="">Fan boʻyicha</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <PlusIcon className="h-4 w-4" />
            Yangi ustoz qoʻshish
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-4 py-3">Familiya Ism</th>
                <th className="px-4 py-3">Fan(lar)</th>
                <th className="px-4 py-3">Rahbarlik sinfi</th>
                <th className="px-4 py-3">Yuklama (soat/hafta)</th>
                <th className="px-4 py-3">Holati</th>
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr className="border-b border-border bg-brand-tint/40">
                  <td className="px-4 py-2.5">
                    <input
                      autoFocus
                      value={draft.fullName}
                      onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
                      placeholder="Familiya Ism"
                      className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={draft.subject}
                      onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                      className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      {subjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      value={draft.homeroom}
                      onChange={(e) => setDraft((d) => ({ ...d, homeroom: e.target.value }))}
                      placeholder="masalan, 7-A"
                      className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-foreground-muted">—</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={addTeacher}
                        className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground hover:bg-brand-dark"
                      >
                        Saqlash
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdding(false)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-foreground-muted hover:bg-surface-muted"
                      >
                        Bekor
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {filtered.map((teacher) => (
                <tr
                  key={teacher.id}
                  className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/rahbar/ustozlar/${teacher.id}`}
                      className="flex items-center gap-2.5 font-medium text-foreground hover:text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand-dark">
                        {teacher.avatarInitials}
                      </span>
                      {teacher.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {teacher.subjects.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {teacher.homeroomClassName ?? <span className="italic">Yoʻq</span>}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{teacher.weeklyLoadHours}</td>
                  <td className="px-4 py-3">
                    <Badge tone={teacher.status === "active" ? "success" : "neutral"}>
                      {teacher.status === "active" ? "Faol" : "Arxivlangan"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && !adding && (
          <div className="p-6">
            <EmptyState title="Hech narsa topilmadi" description="Boshqa fan bo'yicha filtrlab ko'ring." />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-foreground-muted">
          <span>Jami: {filtered.length} ta ustoz</span>
        </div>
      </div>
    </div>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
