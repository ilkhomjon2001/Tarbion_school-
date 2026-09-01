"use client";

/**
 * Mening ustozlarim — BAZADAN (jadval boʻyicha).
 *
 * X-6: faqat ism, fanlar va sinf rahbari belgisi — login, telefon yoki
 * boshqa shaxsiy maʼlumot serverdan kelmaydi.
 */

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  fetchMyTeachers,
  fetchStudentMe,
  type MyTeacher,
} from "@/lib/student/api";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<MyTeacher[] | null>(null);
  const [xato, setXato] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await fetchStudentMe();
        if (!me.studentId) throw new Error("student yoʻq");
        const rows = await fetchMyTeachers(me.studentId);
        if (alive) setTeachers(rows);
      } catch {
        if (alive) setXato(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <Header title="Ustozlarim" />
      <div className="flex flex-col gap-2 p-4">
        {xato && (
          <ErrorState description="Roʻyxatni olib boʻlmadi. Sahifani yangilab koʻring." />
        )}
        {!xato && teachers === null && <ListSkeleton count={5} />}
        {teachers !== null && teachers.length === 0 && (
          <EmptyState
            title="Jadval hali tuzilmagan"
            description="Sinfingiz jadvali kiritilgach ustozlar shu yerda koʻrinadi."
          />
        )}
        {teachers?.map((t) => (
          <div
            key={t.teacherId}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{t.fullName}</p>
              <p className="truncate text-sm text-foreground-muted">
                {t.subjects.length > 0 ? t.subjects.join(", ") : "Fan biriktirilmagan"}
              </p>
            </div>
            {t.isHomeroom && (
              <span className="shrink-0 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand-dark">
                Sinf rahbari
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
