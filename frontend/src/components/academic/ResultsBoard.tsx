"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChartIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import { EXAMS, resultsOf, statsOf, type Exam } from "@/lib/school/exams";
import { staffById } from "@/lib/school/staff";

/** Ball rangi — 80+ yaxshi, 60+ oʻrta, pastrogʻi «2». */
function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

const TONE_TEXT = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

const TONE_BAR = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

/**
 * Imtihon natijalari — sinf boʻyicha oʻquvchilar roʻyxati va taqsimot.
 *
 * Oʻquv boʻlimi shu yerdan «qaysi sinfda muammo bor» degan savolga javob
 * oladi: past natijalar tepaga chiqadi, «2» olganlar alohida sanaladi.
 */
export function ResultsBoard() {
  const withResults = useMemo(
    () => EXAMS.filter((e) => e.resultsEntered).sort((a, b) => b.date.localeCompare(a.date)),
    [],
  );
  const [activeId, setActiveId] = useState(withResults[0]?.id ?? "");

  const active = withResults.find((e) => e.id === activeId) ?? withResults[0] ?? null;

  // Eng past natijali imtihonlar — eʼtibor talab qiladiganlari.
  const weakest = useMemo(
    () =>
      withResults
        .map((exam) => ({ exam, stats: statsOf(exam.id) }))
        .filter((r) => r.stats !== null)
        .sort((a, b) => (a.stats?.average ?? 0) - (b.stats?.average ?? 0))
        .slice(0, 5),
    [withResults],
  );

  if (!active) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          icon={<BarChartIcon className="h-5 w-5" />}
          title="Natija yoʻq"
          description="Hali birorta imtihon natijasi kiritilmagan."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Natijalar</h1>
        <p className="text-sm text-foreground-muted">
          Imtihon natijalari, ball taqsimoti va eʼtibor talab qiladigan sinflar
        </p>
      </div>

      {/* Eng past natijalar */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <h2 className="border-b border-border px-4 py-3 text-base font-semibold text-foreground">
          Eʼtibor talab qiladi — eng past 5 natija
        </h2>
        <ul className="divide-y divide-border">
          {weakest.map(({ exam, stats }) => (
            <li key={exam.id}>
              <button
                type="button"
                onClick={() => setActiveId(exam.id)}
                className="focus-ring-inset flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {exam.className} · {exam.subject}
                  </span>
                  <span className="block truncate text-xs text-foreground-muted">
                    {exam.date} · {staffById(exam.teacherId)?.shortName ?? "—"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`num block text-sm font-semibold ${TONE_TEXT[scoreTone(stats?.average ?? 0)]}`}
                  >
                    {stats?.average}
                  </span>
                  {(stats?.failing ?? 0) > 0 && (
                    <span className="num block text-xs text-danger">
                      {stats?.failing} ta «2»
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-foreground">Imtihonni tanlang</span>
        <select
          value={active.id}
          onChange={(e) => setActiveId(e.target.value)}
          className="focus-ring h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm sm:max-w-md"
        >
          {withResults.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.date} · {exam.className} · {exam.subject}
            </option>
          ))}
        </select>
      </label>

      <ExamDetail exam={active} />
    </div>
  );
}

function ExamDetail({ exam }: { exam: Exam }) {
  const results = useMemo(() => resultsOf(exam.id), [exam.id]);
  const stats = useMemo(() => statsOf(exam.id), [exam.id]);

  // Ball taqsimoti — 10 ballik guruhlarda.
  const buckets = useMemo(() => {
    const rows = [
      { label: "90–100", min: 90, max: 100 },
      { label: "80–89", min: 80, max: 89 },
      { label: "70–79", min: 70, max: 79 },
      { label: "60–69", min: 60, max: 69 },
      { label: "60 dan past", min: 0, max: 59 },
    ];
    return rows.map((row) => ({
      ...row,
      count: results.filter(
        (r) => !r.absent && r.score !== null && r.score >= row.min && r.score <= row.max,
      ).length,
    }));
  }, [results]);

  const maxBucket = Math.max(...buckets.map((b) => b.count), 1);

  const sorted = useMemo(
    () =>
      [...results].sort((a, b) => {
        if (a.absent !== b.absent) return a.absent ? 1 : -1;
        return (b.score ?? 0) - (a.score ?? 0);
      }),
    [results],
  );

  if (!stats) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-foreground">{exam.title}</h2>
          <p className="text-sm text-foreground-muted">
            {exam.className} · {exam.date} · {staffById(exam.teacherId)?.fullName ?? "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadCsv(`tarbion-${exam.className}-${exam.subject}-${exam.date}`, [
              ["Oʻquvchi", "Ball", "Holati"],
              ...sorted.map((r) => [
                r.studentName,
                r.absent ? "—" : String(r.score),
                r.absent ? "Kelmagan" : (r.score ?? 0) < 60 ? "Oʻtmadi" : "Oʻtdi",
              ]),
            ])
          }
          className="focus-ring h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          Natijani yuklab olish (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Oʻrtacha" value={stats.average} tone={scoreTone(stats.average)} />
        <Stat label="Eng yuqori" value={stats.highest} tone="success" />
        <Stat label="Eng past" value={stats.lowest} tone={scoreTone(stats.lowest)} />
        <Stat
          label="«2» olgan"
          value={stats.failing}
          tone={stats.failing > 0 ? "danger" : "success"}
        />
        <Stat label="Kelmagan" value={stats.absent} tone={stats.absent > 0 ? "warning" : "success"} />
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-foreground">Ball taqsimoti</h3>
        <ul className="flex flex-col gap-2">
          {buckets.map((bucket) => (
            <li key={bucket.label} className="flex items-center gap-3">
              <span className="num w-24 shrink-0 text-sm text-foreground-muted">
                {bucket.label}
              </span>
              <span className="h-2.5 min-w-0 flex-1 rounded-full bg-surface-muted">
                <span
                  className={`bar-fill block h-full rounded-full ${TONE_BAR[scoreTone(bucket.min)]}`}
                  style={{ width: `${(bucket.count / maxBucket) * 100}%` }}
                />
              </span>
              <span className="num w-12 shrink-0 text-right text-sm text-foreground">
                {bucket.count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">№</th>
                <th className="px-3 py-3">Oʻquvchi</th>
                <th className="px-3 py-3">Ball</th>
                <th className="px-3 py-3">Holati</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={r.studentId}
                  className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="num px-3 py-2 text-foreground-muted">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{r.studentName}</td>
                  <td className="px-3 py-2">
                    {r.absent ? (
                      <span className="text-foreground-muted">—</span>
                    ) : (
                      <span
                        className={`num font-semibold ${TONE_TEXT[scoreTone(r.score ?? 0)]}`}
                      >
                        {r.score}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.absent ? (
                      <Badge tone="neutral">Kelmagan</Badge>
                    ) : (r.score ?? 0) < 60 ? (
                      <Badge tone="danger">Oʻtmadi</Badge>
                    ) : (
                      <Badge tone="success">Oʻtdi</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
          Ball oʻzgartirilsa audit jurnaliga eski va yangi qiymat bilan tushadi —
          baho bilan bir xil darajadagi maʼlumot.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className={`num mt-0.5 text-lg font-bold ${TONE_TEXT[tone]}`}>{value}</p>
    </div>
  );
}
