"use client";

/**
 * Ustoz sahifasi — BAZADAN.
 *
 * Avval bu sahifa mock `fetchers` va soxta KPI ustida edi. Endi
 * `director/teachers` roʻyxatidan shu ustoz topib koʻrsatiladi —
 * roʻyxat jadvali (`LiveTeacherTable`) bilan bir xil manba, shuning
 * uchun raqamlar hech qachon farq qilmaydi. Chuqurroq kesim (dars
 * jadvali, sinflari) uchun alohida endpoint hali yoʻq.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { GraduationCapIcon } from "@/components/ui/icons";
import { messageOf } from "@/components/shared/LiveSession";
import { fetchTeachers, type TeacherRowOut } from "@/lib/director/api";

export default function TeacherProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [teachers, setTeachers] = useState<TeacherRowOut[] | null>(null);
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

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      </div>
    );
  }

  if (teachers === null) {
    return (
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <CardSkeleton />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const teacher = teachers.find((t) => t.id === id);

  if (!teacher) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          icon={<GraduationCapIcon className="h-5 w-5" />}
          title="Ustoz topilmadi"
          description="Bu hisob arxivlangan yoki manzil notoʻgʻri boʻlishi mumkin."
          action={
            <Link
              href="/rahbar/ustozlar"
              className="focus-ring rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
            >
              Ustozlar roʻyxatiga qaytish
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <Link
          href="/rahbar/ustozlar"
          className="focus-ring rounded text-sm font-medium text-brand-dark hover:underline"
        >
          ← Ustozlar roʻyxati
        </Link>
      </div>

      <Card className="animate-enter">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-tint text-lg font-semibold text-brand-dark">
            {initials(teacher.full_name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-h2 font-bold text-foreground">
              {teacher.full_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-muted">
              <span>{teacher.subjects.join(", ") || "Fan biriktirilmagan"}</span>
              {teacher.homeroom_class_name && (
                <span>Sinf rahbari: {teacher.homeroom_class_name}</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Haftalik yuklama"
          value={teacher.weekly_hours}
          suffix=" soat"
          note="Dars jadvalidan"
          zeroNote="Jadvalda darsi yoʻq"
        />
        <Stat
          label="Jadvaldagi darslar"
          value={teacher.lessons_planned}
          note="Bugungacha, jadval boʻyicha"
          zeroNote="Bugungacha darsi boʻlmagan"
        />
        <Stat
          label="Oʻtilgan darslar"
          value={teacher.lessons_with_attendance}
          note={
            teacher.lessons_planned > 0
              ? `Jadvaldagi ${teacher.lessons_planned} tadan`
              : undefined
          }
          zeroNote="Hali davomat belgilanmagan"
        />
        <Stat
          label="Qoʻyilgan baholar"
          value={teacher.grades_given}
          note="Jurnal boʻyicha"
          zeroNote="Hali baho qoʻyilmagan"
        />
        <Stat
          label="Oʻrtacha baho"
          value={teacher.grades_given > 0 ? teacher.average_grade_given : 0}
          format={(v) => v.toFixed(1)}
          note="Ustoz qoʻygan baholar boʻyicha"
          zeroNote="Hali baho qoʻyilmagan"
        />
        <Stat
          label="Imtihonlar"
          value={teacher.exams_held}
          note="Oʻtkazilgan imtihon va nazorat ishlari"
          zeroNote="Hali imtihon olinmagan"
        />
        <Stat
          label="Uy vazifasi"
          value={teacher.homework_given}
          note="Berilgan vazifalar"
          zeroNote="Hali vazifa berilmagan"
        />
      </div>

      <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
        Nol koʻrsatkich ustozning bahosi emas — u faoliyat hali
        boshlanmaganini bildiradi va katak tagida sababi yozilgan. Oʻquv
        yili boshida bu tabiiy holat.
      </p>
    </div>
  );
}

/**
 * KPI katagi.
 *
 * Nol YASHIRILMAYDI va «—» bilan almashtirilmaydi (loyiha egasining
 * soʻrovi, 2026-09-03): chiziqcha «maʼlumot yoʻq» degan taassurot
 * qoldiradi va rahbar sahifani buzuq deb oʻylaydi. Nol esa aniq
 * fakt — faqat sababi yozilishi kerak.
 */
function Stat({
  label,
  value,
  note,
  zeroNote,
  suffix = "",
  format,
}: {
  label: string;
  value: number;
  note?: string;
  zeroNote: string;
  suffix?: string;
  format?: (v: number) => string;
}) {
  const bosh = value === 0;
  const matn = format ? format(value) : value.toLocaleString("uz-Latn");
  return (
    <Card className="animate-enter">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p
        className={`num mt-2 text-2xl font-bold ${
          bosh ? "text-foreground-muted" : "text-foreground"
        }`}
      >
        {matn}
        {suffix}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">{bosh ? zeroNote : (note ?? "")}</p>
    </Card>
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
