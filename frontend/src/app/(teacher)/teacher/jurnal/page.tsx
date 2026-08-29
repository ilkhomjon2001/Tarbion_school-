"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { GradeBook } from "@/components/teacher/GradeBook";
import {
  allSubjectsIn,
  canGrade,
  isHomeroomOf,
  myClasses,
  mySubjectsIn,
} from "@/lib/teacher/roles";
import { StudentCard } from "@/components/teacher/StudentCard";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { buildInitialRows } from "@/lib/teacher/data";
import { classColor } from "@/lib/teacher/schedule";
import {
  conductedForClass,
  studentStats,
  type ConductedLesson,
  type StudentStats,
} from "@/lib/teacher/store";
import { ACADEMIC_YEAR, termForDate } from "@/lib/teacher/terms";
import { TODAY } from "@/lib/teacher/schedule";

/**
 * Sinf jurnali (JUR-01, DAV-02, DAV-06).
 *
 * Faqat SINF RAHBARIga koʻrinadi — oddiy ustoz oʻz darsining davomatini
 * belgilaydi, lekin butun sinfning umumiy koʻrinishi sinf rahbariniki
 * (CLAUDE.md: sinf rahbari = ustoz + oʻz sinfi boʻyicha kengaytirilgan
 * huquq).
 *
 * Ikki koʻrinish:
 *   Oʻquvchilar — har bir bolaning davomat statistikasi
 *   Darslar     — oʻtilgan darslar va mavzular
 */

type View = "grades" | "students" | "lessons";

export default function JournalPage() {
  const classes = myClasses();

  const [selected, setSelected] = useState(classes[0]);
  const [view, setView] = useState<View>("grades");
  const [subject, setSubject] = useState(
    mySubjectsIn(classes[0])[0] ?? allSubjectsIn(classes[0])[0],
  );
  const [stats, setStats] = useState<StudentStats[] | null>(null);
  const [lessons, setLessons] = useState<ConductedLesson[] | null>(null);
  const [openStudent, setOpenStudent] = useState<StudentStats | null>(null);

  useEffect(() => {
    // localStorage faqat brauzerda.
    setStats(studentStats(selected));
    setLessons(conductedForClass(selected));
    // Sinf almashganda oʻzi oʻqitadigan fan tanlansin.
    setSubject(mySubjectsIn(selected)[0] ?? allSubjectsIn(selected)[0]);
  }, [selected]);

  const roster = useMemo(() => buildInitialRows(selected), [selected]);
  const term = termForDate(TODAY);

  /** Hali dars oʻtilmagan boʻlsa ham roʻyxat toʻliq koʻrinsin. */
  const rows: StudentStats[] = useMemo(() => {
    if (stats === null) return [];
    if (stats.length > 0) return stats;
    return roster.map((r) => ({
      studentId: r.studentId,
      fullName: r.fullName,
      present: 0,
      absent: 0,
      excused: 0,
      late: 0,
      total: 0,
      percent: 100,
    }));
  }, [stats, roster]);

  const summary = useMemo(() => {
    const withData = rows.filter((r) => r.total > 0);
    const atRisk = withData.filter((r) => r.percent < 80);
    const avg = withData.length
      ? Math.round(withData.reduce((s, r) => s + r.percent, 0) / withData.length)
      : null;
    return {
      students: rows.length,
      lessons: lessons?.length ?? 0,
      avg,
      atRisk: atRisk.length,
    };
  }, [rows, lessons]);

  const homeroom = isHomeroomOf(selected);

  /**
   * Koʻrinadigan fanlar:
   *   sinf rahbari  — sinfdagi BARCHA fanlar (oʻzinikidan boshqasi faqat oʻqish)
   *   fan ustozi    — faqat oʻzi oʻqitadigan fanlar
   */
  const visibleSubjects = homeroom ? allSubjectsIn(selected) : mySubjectsIn(selected);
  const editable = canGrade(selected, subject);

  return (
    <TeacherShell
      title="Sinf jurnali"
      subtitle={`${selected} · ${homeroom ? "sinf rahbari" : "fan ustozi"} · ${ACADEMIC_YEAR}${term ? ` · ${term.name}` : ""}`}
    >
      {classes.length > 1 && (
        <div role="tablist" aria-label="Sinf" className="mb-4 flex flex-wrap gap-2">
          {classes.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={selected === c}
              onClick={() => setSelected(c)}
              className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                selected === c
                  ? "border-brand bg-brand-tint text-brand-dark"
                  : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${classColor(c).dot}`} />
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Xulosa */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Oʻquvchilar" value={summary.students} />
        <Stat label="Oʻtilgan darslar" value={summary.lessons} />
        <Stat
          label="Oʻrtacha davomat"
          value={summary.avg === null ? "—" : `${summary.avg}%`}
          tone="text-success"
        />
        <Stat
          label="Xavf ostida (<80%)"
          value={summary.atRisk}
          tone={summary.atRisk > 0 ? "text-danger" : "text-foreground-muted"}
        />
      </div>

      {/* Koʻrinish */}
      <div role="tablist" aria-label="Koʻrinish" className="mb-4 flex gap-2">
        {(
          [
            ["grades", "Baholar"],
            ["students", "Oʻquvchilar"],
            ["lessons", "Oʻtilgan darslar"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              view === key
                ? "border-brand bg-brand-tint text-brand-dark"
                : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "grades" && (
        <>
          {/* Fan tanlash. Oʻzi oʻqitadigan fanlar yashil nuqta bilan
              belgilangan — baho faqat oʻshalarga qoʻyiladi (JUR-01). */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-foreground-muted">Fan:</span>
            {visibleSubjects.map((s) => {
              const mine = canGrade(selected, s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={subject === s}
                  onClick={() => setSubject(s)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    subject === s
                      ? "border-brand bg-brand-tint text-brand-dark"
                      : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                  }`}
                >
                  {mine && (
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-brand"
                      title="Oʻz faningiz"
                    />
                  )}
                  {s}
                  {!mine && <span className="sr-only">— faqat koʻrish</span>}
                </button>
              );
            })}
          </div>

          {homeroom && visibleSubjects.length > mySubjectsIn(selected).length && (
            <p className="mb-3 text-xs text-foreground-muted">
              Yashil nuqtali fanlar — oʻzingiz oʻqitadiganingiz, baho qoʻya
              olasiz. Qolganlarini sinf rahbari sifatida faqat koʻrasiz.
            </p>
          )}

          <GradeBook
            className={selected}
            subject={subject}
            students={roster}
            readOnly={!editable}
          />
        </>
      )}

      {view === "students" && (
        <StudentTable rows={rows} loading={stats === null} onOpen={setOpenStudent} />
      )}

      {view === "lessons" && <LessonTable lessons={lessons} />}

      {openStudent && (
        <StudentCard
          stats={openStudent}
          className={selected}
          onClose={() => setOpenStudent(null)}
        />
      )}

      {summary.lessons === 0 && (
        <p className="mt-3 rounded-lg bg-surface-muted/60 px-3 py-2.5 text-sm text-foreground-muted">
          Hali birorta dars davomati saqlanmagan. Statistika{" "}
          <Link
            href="/teacher"
            className="text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            «Bugun»
          </Link>{" "}
          boʻlimida davomat belgilangandan keyin toʻladi.
        </p>
      )}
    </TeacherShell>
  );
}

/* ---------- Oʻquvchilar jadvali ---------- */

function StudentTable({
  rows,
  loading,
  onOpen,
}: {
  rows: StudentStats[];
  loading: boolean;
  onOpen: (s: StudentStats) => void;
}) {
  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <caption className="sr-only">Oʻquvchilar va ularning davomat statistikasi</caption>
        <thead>
          <tr className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-foreground-muted">
            <th scope="col" className="w-12 px-4 py-3 font-medium">№</th>
            <th scope="col" className="px-4 py-3 font-medium">Familiya, ism</th>
            <th scope="col" className="w-24 px-3 py-3 text-center font-medium">Keldi</th>
            <th scope="col" className="w-24 px-3 py-3 text-center font-medium">Kelmadi</th>
            <th scope="col" className="w-24 px-3 py-3 text-center font-medium">Sababli</th>
            <th scope="col" className="w-24 px-3 py-3 text-center font-medium">Kechikdi</th>
            <th scope="col" className="w-32 px-4 py-3 font-medium">Davomat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const atRisk = s.total > 0 && s.percent < 80;
            return (
              <tr
                key={s.studentId}
                className={`border-b border-border last:border-0 transition-colors hover:bg-surface-muted/40 ${
                  atRisk ? "bg-danger-tint/30" : ""
                }`}
              >
                <td className="relative px-4 py-2.5 text-foreground-muted">
                  {atRisk && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-danger" />}
                  {i + 1}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => onOpen(s)}
                    className="font-medium underline-offset-2 hover:text-brand-dark hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {s.fullName}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-center text-success">{s.present || "—"}</td>
                <td className="px-3 py-2.5 text-center text-danger">{s.absent || "—"}</td>
                <td className="px-3 py-2.5 text-center text-info">{s.excused || "—"}</td>
                <td className="px-3 py-2.5 text-center text-warning">{s.late || "—"}</td>
                <td className="px-4 py-2.5">
                  {s.total === 0 ? (
                    <span className="text-foreground-muted">—</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted"
                        role="presentation"
                      >
                        <span
                          className={`block h-full rounded-full ${atRisk ? "bg-danger" : "bg-success"}`}
                          style={{ width: `${s.percent}%` }}
                        />
                      </span>
                      <span className={`text-sm font-medium ${atRisk ? "text-danger" : ""}`}>
                        <span className="num">{s.percent}%</span>
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Oʻtilgan darslar ---------- */

function LessonTable({ lessons }: { lessons: ConductedLesson[] | null }) {
  if (lessons === null) {
    return <div className="h-48 animate-pulse rounded-xl border border-border bg-surface" />;
  }
  if (lessons.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
        <p className="font-medium">Hali dars oʻtilmagan</p>
        <p className="mt-1 text-sm text-foreground-muted">
          Dars davomat saqlanganda jurnalga tushadi, mavzusi bilan birga.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">Oʻtilgan darslar va mavzular</caption>
        <thead>
          <tr className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-foreground-muted">
            <th scope="col" className="w-12 px-4 py-3 font-medium">№</th>
            <th scope="col" className="w-28 px-4 py-3 font-medium">Sana</th>
            <th scope="col" className="w-16 px-3 py-3 font-medium">Para</th>
            <th scope="col" className="w-32 px-4 py-3 font-medium">Fan</th>
            <th scope="col" className="px-4 py-3 font-medium">Oʻtilgan mavzu</th>
            <th scope="col" className="w-40 px-4 py-3 font-medium">Davomat</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((e, i) => (
            <tr key={e.lessonId} className="border-b border-border last:border-0 hover:bg-surface-muted/40">
              <td className="px-4 py-2.5 text-foreground-muted">{i + 1}</td>
              <td className="whitespace-nowrap px-4 py-2.5">{e.date}</td>
              <td className="px-3 py-2.5 text-foreground-muted">{e.period}</td>
              <td className="px-4 py-2.5">{e.subject}</td>
              <td className="px-4 py-2.5">
                {e.topic || <span className="text-foreground-muted">Mavzu yozilmagan</span>}
              </td>
              <td className="px-4 py-2.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className="text-success">{e.present} keldi</span>
                  {e.absent > 0 && <span className="text-danger">{e.absent} kelmadi</span>}
                  {e.excused > 0 && <span className="text-info">{e.excused} sababli</span>}
                  {e.late > 0 && <span className="text-warning">{e.late} kechikdi</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-foreground-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold num ${tone}`}>{value}</p>
    </div>
  );
}
