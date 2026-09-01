"use client";

/**
 * Ustozlar roʻyxati — BAZADAN (DIR-04).
 *
 * Eski `TeacherTable` mock ustida edi: soxta KPI (hash'dan) va faqat
 * holatda qoladigan «yangi ustoz» qatori bor edi. Bu jadvalda hamma
 * ustun serverdan keladi; ustoz qoʻshish esa administrator kabinetida
 * (`/admin/sozlamalar` → Xodimlar) — u yerda haqiqiy hisob ochiladi.
 */

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { messageOf } from "@/components/shared/LiveSession";
import { fetchTeachers, type TeacherRowOut } from "@/lib/director/api";

export function LiveTeacherTable() {
  const [teachers, setTeachers] = useState<TeacherRowOut[] | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setTeachers(await fetchTeachers());
      } catch (err) {
        setError(messageOf(err));
      }
    })();
  }, []);

  const subjects = useMemo(
    () => [...new Set((teachers ?? []).flatMap((t) => t.subjects))].sort(),
    [teachers],
  );
  const filtered = useMemo(() => {
    if (!teachers) return [];
    if (!subjectFilter) return teachers;
    return teachers.filter((t) => t.subjects.includes(subjectFilter));
  }, [teachers, subjectFilter]);

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (teachers === null) return <TableSkeleton rows={9} columns={5} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Ustozlar roʻyxati</h1>
          <p className="text-sm text-foreground-muted">
            Yuklama, oʻtilgan darslar va qoʻyilgan baholar — bazadan
          </p>
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label="Fan boʻyicha filtr"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
        >
          <option value="">Fan boʻyicha</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-4 py-3">Familiya Ism</th>
                <th className="px-4 py-3">Fan(lar)</th>
                <th className="px-4 py-3">Rahbarlik sinfi</th>
                <th className="px-4 py-3 text-right">Yuklama (soat/hafta)</th>
                <th className="px-4 py-3 text-right">Oʻtilgan dars</th>
                <th className="px-4 py-3 text-right">Oʻrtacha baho</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((teacher) => (
                <tr
                  key={teacher.id}
                  className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5 font-medium text-foreground">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand-dark">
                        {initials(teacher.full_name)}
                      </span>
                      {teacher.full_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {teacher.subjects.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {teacher.homeroom_class_name ?? <span className="italic">Yoʻq</span>}
                  </td>
                  <td className="num px-4 py-3 text-right text-foreground-muted">
                    {teacher.weekly_hours}
                  </td>
                  <td className="num px-4 py-3 text-right text-foreground-muted">
                    {teacher.lessons_conducted}
                  </td>
                  <td className="num px-4 py-3 text-right font-medium text-foreground">
                    {teacher.grades_given > 0 ? teacher.average_grade_given.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-6">
            <EmptyState
              title="Hech narsa topilmadi"
              description="Boshqa fan boʻyicha filtrlab koʻring."
            />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-foreground-muted">
          <span>Jami: {filtered.length} ta ustoz</span>
          <span>Yangi ustoz administrator kabinetida qoʻshiladi</span>
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
