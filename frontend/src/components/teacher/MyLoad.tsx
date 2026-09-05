"use client";

/**
 * Ustozning haftalik yuklamasi va biriktirilgan sinflari (MET-09).
 *
 * TZ aynan «ustozning SHAXSIY kabinetida» deydi. Rahbariyat
 * koʻrinishi (`/rahbar/ustozlar/[id]`) allaqachon bor edi, lekin
 * ustozning oʻzi «menda haftada nechta soat?» degan savolga javob
 * topa olmasdi.
 *
 * Maʼlumot `useMyTeaching` dan — u jadval yozuvlarini sinf × fan
 * boʻyicha guruhlab, haftalik soatni sanaydi. Yangi endpoint kerak
 * emas: ustoz oʻz jadvalini allaqachon oʻqiydi.
 */

import { useMemo } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { CalendarIcon } from "@/components/ui/icons";
import { useMyTeaching } from "@/lib/teacher/me";

export function MyLoad() {
  const { slots, classes, loading } = useMyTeaching();

  const jamiSoat = useMemo(
    () => slots.reduce((s, x) => s + x.weeklyHours, 0),
    [slots],
  );

  if (loading) return <ListSkeleton count={3} />;

  if (slots.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon className="h-5 w-5" />}
        title="Jadvalingiz boʻsh"
        description="Administrator sizga sinf va fan biriktirgach haftalik yuklamangiz shu yerda koʻrinadi."
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Haftalik yuklama</h2>
        <p className="text-sm text-foreground-muted">
          <span className="num text-lg font-bold text-brand-dark">{jamiSoat}</span> soat
          {" · "}
          {classes.length} ta sinf
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {slots.map((s) => (
          <li
            key={`${s.classId}-${s.subjectId}`}
            className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted/50 px-3 py-2"
          >
            <span className="min-w-0 text-sm">
              <span className="font-medium text-foreground">{s.className}</span>
              <span className="text-foreground-muted"> · {s.subjectName}</span>
            </span>
            <span className="num shrink-0 text-sm font-semibold text-foreground">
              {s.weeklyHours} soat
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-foreground-muted">
        Soat dars jadvalidan sanaladi. Bir kunga qilingan almashtirish
        (ADM-10) bu yerga taʼsir qilmaydi — u jadvalni oʻzgartirmaydi.
      </p>
    </div>
  );
}
