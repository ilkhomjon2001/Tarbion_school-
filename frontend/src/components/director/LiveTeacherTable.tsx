"use client";

/**
 * Ustozlar roʻyxati — BAZADAN (DIR-04).
 *
 * Eski `TeacherTable` mock ustida edi: soxta KPI (hash'dan) va faqat
 * holatda qoladigan «yangi ustoz» qatori bor edi. Bu jadvalda hamma
 * ustun serverdan keladi; ustoz qoʻshish esa administrator kabinetida
 * (`/admin/sozlamalar` → Xodimlar) — u yerda haqiqiy hisob ochiladi.
 */

import Link from "next/link";
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
            Yuklama, oʻtilgan dars, baho, imtihon va uy vazifasi — bazadan.
            «Oʻtilgan» — davomat belgilangan dars: jadvalda turgani
            darsning boʻlganini bildirmaydi.
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
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-4 py-3">Familiya Ism</th>
                <th className="px-4 py-3">Fan(lar)</th>
                <th className="px-4 py-3">Rahbarlik sinfi</th>
                <th className="px-4 py-3 text-right">Yuklama (soat/hafta)</th>
                <th className="px-4 py-3 text-right">Jadvaldagi dars</th>
                <th className="px-4 py-3 text-right">Oʻtilgan dars</th>
                <th className="px-4 py-3 text-right">Oʻrtacha baho</th>
                <th className="px-4 py-3 text-right">Imtihon</th>
                <th className="px-4 py-3 text-right">Uy vazifasi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((teacher) => (
                <tr
                  key={teacher.id}
                  className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/rahbar/ustozlar/${teacher.id}`}
                      className="focus-ring flex items-center gap-2.5 rounded font-medium text-foreground hover:text-brand-dark hover:underline"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand-dark">
                        {initials(teacher.full_name)}
                      </span>
                      {teacher.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {teacher.subjects.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {teacher.homeroom_class_name ?? <span className="italic">Yoʻq</span>}
                  </td>
                  <Kpi
                    value={teacher.weekly_hours}
                    zeroNote="Jadvalda darsi yoʻq"
                  />
                  <Kpi
                    value={teacher.lessons_planned}
                    note="Bugungacha"
                    zeroNote="Bugungacha darsi boʻlmagan"
                  />
                  <Kpi
                    value={teacher.lessons_with_attendance}
                    note={
                      teacher.lessons_planned > 0
                        ? `${teacher.lessons_planned} tadan`
                        : undefined
                    }
                    zeroNote="Hali davomat belgilanmagan"
                  />
                  <Kpi
                    value={teacher.grades_given > 0 ? teacher.average_grade_given : 0}
                    format={(v) => v.toFixed(1)}
                    note={
                      teacher.grades_given > 0 ? `${teacher.grades_given} ta baho` : undefined
                    }
                    zeroNote="Hali baho qoʻyilmagan"
                    strong
                  />
                  <Kpi value={teacher.exams_held} zeroNote="Hali imtihon olinmagan" />
                  <Kpi value={teacher.homework_given} zeroNote="Hali vazifa berilmagan" />
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

      {/* Nolning maʼnosi bir xil emas: «ishlamayapti» ham, «hali
          navbati kelmagan» ham boʻlishi mumkin. Ustundagi izoh aynan
          shuni ajratadi — usiz rahbar nolni baho deb oʻqiydi. */}
      <p className="mt-2 text-xs text-foreground-muted">
        Nol koʻrsatkich ustunda izoh bilan koʻrsatiladi: u ustozning
        bahosi emas, faoliyat hali boshlanmaganini bildiradi. Oʻquv yili
        boshida bu tabiiy holat.
      </p>
    </div>
  );
}

/**
 * Bitta KPI katagi.
 *
 * Nol qiymat YASHIRILMAYDI va «—» bilan almashtirilmaydi (loyiha
 * egasining soʻrovi, 2026-09-03). Chiziqcha «maʼlumot yoʻq» degan
 * maʼnoni beradi va rahbar uni buzuq deb oʻylaydi; nol esa aniq
 * fakt — faqat sababini aytish kerak.
 */
function Kpi({
  value,
  note,
  zeroNote,
  format,
  strong,
}: {
  value: number;
  note?: string;
  zeroNote: string;
  format?: (v: number) => string;
  strong?: boolean;
}) {
  const bosh = value === 0;
  return (
    <td className="px-4 py-3 text-right align-top">
      <span
        className={`num block ${
          bosh
            ? "text-foreground-muted"
            : strong
              ? "font-medium text-foreground"
              : "text-foreground-muted"
        }`}
      >
        {format ? format(value) : value}
      </span>
      {(bosh || note) && (
        <span className="mt-0.5 block text-xs leading-tight text-foreground-muted">
          {bosh ? zeroNote : note}
        </span>
      )}
    </td>
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
