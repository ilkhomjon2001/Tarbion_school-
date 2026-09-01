"use client";

/**
 * Sifat nazorati — BAZADAN, direktor API'sidan.
 *
 * Alohida «sifat» jadvali YOʻQ va kerak emas: sifat koʻrsatkichlari
 * mavjud maʼlumotdan chiqadi — sinflar kesimida davomat va oʻrtacha
 * baho (`/director/classes`, oʻquv boʻlimi roli uchun ochiq) hamda
 * oʻtkazilgan imtihonlarning oʻzlashtirish foizi (`/exams`).
 */

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BarChartIcon } from "@/components/ui/icons";
import { fetchClasses, type ClassRowOut } from "@/lib/director/api";
import { fetchExams, type ExamOut } from "@/lib/exams/api";

export function QualityBoard() {
  const [classes, setClasses] = useState<ClassRowOut[] | null>(null);
  const [exams, setExams] = useState<ExamOut[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchClasses(), fetchExams()])
      .then(([c, x]) => {
        if (!alive) return;
        setClasses(c);
        setExams(x.filter((e) => e.status === "otkazildi" && e.stats.pass_rate !== null));
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  // Sinf boʻyicha imtihon oʻzlashtirishining oʻrtachasi.
  const passByClass = new Map<string, number[]>();
  for (const e of exams ?? []) {
    if (e.stats.pass_rate !== null) {
      passByClass.set(e.class_name, [...(passByClass.get(e.class_name) ?? []), e.stats.pass_rate]);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Sifat nazorati</h1>
        <p className="text-sm text-foreground-muted">
          Sinflar kesimida davomat, oʻrtacha baho va imtihon oʻzlashtirishi
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Maʼlumotni olib boʻlmadi.
        </p>
      ) : classes === null ? (
        <ListSkeleton count={5} />
      ) : classes.length === 0 ? (
        <EmptyState icon={<BarChartIcon className="h-5 w-5" />} title="Maʼlumot yoʻq" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3 text-right">Oʻquvchi</th>
                  <th className="px-3 py-3 text-right">Davomat</th>
                  <th className="px-3 py-3 text-right">Oʻrtacha baho</th>
                  <th className="px-3 py-3 text-right">Imtihon oʻzlashtirishi</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const pass = passByClass.get(c.name);
                  const passAvg = pass
                    ? Math.round(pass.reduce((a, b) => a + b, 0) / pass.length)
                    : null;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">{c.name}</td>
                      <td className="num px-3 py-2.5 text-right text-foreground-muted">
                        {c.student_count}
                      </td>
                      <td className="num px-3 py-2.5 text-right">
                        <span
                          className={
                            c.attendance_percent < 85
                              ? "font-semibold text-danger"
                              : "text-foreground"
                          }
                        >
                          {c.attendance_percent}%
                        </span>
                      </td>
                      <td className="num px-3 py-2.5 text-right text-foreground">
                        {c.average_grade}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-foreground">
                        {passAvg === null ? "—" : `${passAvg}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            Davomat 85% dan past sinf qizil bilan belgilanadi. Barcha raqamlar
            jonli maʼlumotdan hisoblanadi — alohida «sifat» jadvali yoʻq.
          </p>
        </div>
      )}
    </div>
  );
}
