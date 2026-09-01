"use client";

/**
 * Natijalar — oʻtkazilgan imtihonlar statistikasi, BAZADAN.
 *
 * Imtihonlar boʻlimi bilan bir xil manba (`/exams`), lekin bu ekran
 * kiritish emas, TAHLIL uchun: oʻrtacha, oʻzlashtirish, eng past ball.
 */

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BarChartIcon } from "@/components/ui/icons";
import {
  EXAM_KIND_LABELS,
  fetchExams,
  type ExamOut,
} from "@/lib/exams/api";

export function ResultsBoard() {
  const [exams, setExams] = useState<ExamOut[] | null>(null);
  const [error, setError] = useState(false);
  const [kind, setKind] = useState("");

  useEffect(() => {
    let alive = true;
    fetchExams()
      .then((rows) => alive && setExams(rows.filter((x) => x.status === "otkazildi")))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = (exams ?? []).filter((x) => !kind || x.kind === kind);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Natijalar</h1>
          <p className="text-sm text-foreground-muted">
            Oʻtkazilgan imtihonlar tahlili — oʻzlashtirish chegarasi 60 ball
          </p>
        </div>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Imtihon turi"
          className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus-visible:border-brand"
        >
          <option value="">Barcha turlar</option>
          {Object.entries(EXAM_KIND_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Natijalarni olib boʻlmadi.
        </p>
      ) : exams === null ? (
        <ListSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BarChartIcon className="h-5 w-5" />}
          title="Natija yoʻq"
          description="Imtihon oʻtkazilib ball kiritilgach shu yerda koʻrinadi."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Imtihon</th>
                  <th className="px-3 py-3">Sinf · Fan</th>
                  <th className="px-3 py-3">Sana</th>
                  <th className="px-3 py-3 text-right">Oʻrtacha</th>
                  <th className="px-3 py-3 text-right">Eng yuqori / past</th>
                  <th className="px-3 py-3 text-right">Oʻzlashtirish</th>
                  <th className="px-3 py-3 text-right">Kelmagan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((x) => (
                  <tr
                    key={x.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{x.title}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {x.class_name} · {x.subject_name}
                    </td>
                    <td className="num px-3 py-2.5 text-foreground-muted">{x.exam_date}</td>
                    <td className="num px-3 py-2.5 text-right font-semibold text-foreground">
                      {x.stats.average ?? "—"}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-foreground-muted">
                      {x.stats.highest ?? "—"} / {x.stats.lowest ?? "—"}
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      <span
                        className={
                          (x.stats.pass_rate ?? 100) < 70
                            ? "font-semibold text-danger"
                            : "text-foreground"
                        }
                      >
                        {x.stats.pass_rate === null ? "—" : `${x.stats.pass_rate}%`}
                      </span>
                    </td>
                    <td className="num px-3 py-2.5 text-right text-foreground-muted">
                      {x.stats.absent}
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
