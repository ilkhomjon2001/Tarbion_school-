"use client";

/**
 * Ustozlar faoliyati — BAZADAN, direktor API'sidan.
 *
 * Yuklama, oʻtkazilgan dars va qoʻyilgan baholar. Manba
 * `/director/teachers` — router oʻquv boʻlimi roliga ham ochiq.
 */

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { UsersIcon } from "@/components/ui/icons";
import { fetchTeachers, type TeacherRowOut } from "@/lib/director/api";

export function AcademicTeachersBoard() {
  const [rows, setRows] = useState<TeacherRowOut[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    fetchTeachers()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = (rows ?? []).filter(
    (t) =>
      !query ||
      t.full_name.toLowerCase().includes(query.toLowerCase()) ||
      t.subjects.some((s) => s.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Ustozlar faoliyati</h1>
          <p className="text-sm text-foreground-muted">
            Yuklama, oʻtkazilgan darslar va baholash faolligi
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ism yoki fan boʻyicha…"
          aria-label="Ustozlarni qidirish"
          className="h-9 w-56 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Maʼlumotni olib boʻlmadi.
        </p>
      ) : rows === null ? (
        <ListSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<UsersIcon className="h-5 w-5" />} title="Ustoz topilmadi" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Ustoz</th>
                  <th className="px-3 py-3">Fanlari</th>
                  <th className="px-3 py-3">Sinf rahbari</th>
                  <th className="px-3 py-3 text-right">Haftalik soat</th>
                  <th className="px-3 py-3 text-right">Jadvaldagi darsi</th>
                  <th className="px-3 py-3 text-right">Qoʻygan bahosi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{t.full_name}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {t.subjects.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {t.homeroom_class_name ?? "—"}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-foreground">
                      {t.weekly_hours}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-foreground-muted">
                      {t.lessons_planned}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-foreground-muted">
                      {t.grades_given}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
