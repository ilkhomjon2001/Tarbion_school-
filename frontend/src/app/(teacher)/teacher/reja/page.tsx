"use client";

import Link from "next/link";

import { TeacherShell } from "@/components/teacher/TeacherShell";

/**
 * Dars rejasi — fan tanlash (MET-01).
 *
 * Ustoz faqat oʻzi oʻqitadigan fanlarni koʻradi. Butun maktabning 20 ta
 * fani roʻyxati ustozga keraksiz — u faqat oʻz fanidan dars beradi.
 */

interface SubjectCard {
  id: string;
  name: string;
  emoji: string;
  classes: string;
  description: string;
  ready: boolean;
  lessonCount: number;
}

/** Demo ustozining fanlari. Backendda bu `teacher_subjects` dan keladi. */
const MY_SUBJECTS: SubjectCard[] = [
  {
    id: "robototexnika",
    name: "Robototexnika va IT",
    emoji: "🤖",
    classes: "0–8-sinf",
    description:
      "Konstruksiya, mexanizmlar, elektronika, Arduino, ESP32 va sunʼiy intellekt",
    ready: true,
    lessonCount: 1512,
  },
  {
    id: "matematika",
    name: "Matematika",
    emoji: "📐",
    classes: "1–11-sinf",
    description: "Arifmetika, algebra, geometriya, ehtimollar va statistika",
    ready: false,
    lessonCount: 0,
  },
];

export default function SubjectPickerPage() {
  return (
    <TeacherShell
      title="Dars rejasi"
      subtitle="Oʻzingiz oʻqitadigan fanlar"
    >
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MY_SUBJECTS.map((subject) => {
          const body = (
            <>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-2xl"
                >
                  {subject.emoji}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{subject.name}</p>
                  <p className="text-sm text-foreground-muted">{subject.classes}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-foreground-muted">{subject.description}</p>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                {subject.ready ? (
                  <>
                    <span className="inline-flex items-center rounded-full bg-success-tint px-2.5 py-1 text-xs font-medium text-success">
                      Tayyor
                    </span>
                    <span className="text-sm font-semibold text-brand-dark">
                      {subject.lessonCount.toLocaleString("uz-UZ")} ta dars rejasi
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground-muted">
                      Tayyorlanmoqda
                    </span>
                    <span className="text-sm text-foreground-muted">Reja hali yoʻq</span>
                  </>
                )}
              </div>
            </>
          );

          return (
            <li key={subject.id}>
              {subject.ready ? (
                <Link
                  href={`/teacher/reja/${subject.id}`}
                  className="block h-full rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/50 hover:bg-surface-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full cursor-not-allowed rounded-xl border border-border bg-surface p-4 opacity-60">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </TeacherShell>
  );
}
