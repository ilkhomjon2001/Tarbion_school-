"use client";

/**
 * Hisobotlar — BAZADAN (Y11 tuzatildi).
 *
 * Avval bu sahifa butunlay mock generatorlar ustida edi (soxta trend,
 * soxta reyting). Endi uch manba, hammasi server: umumiy koʻrsatkichlar
 * (`director/overview`), sinflar kesimi (`director/classes`) va moliya
 * jamlanmasi (`payments/summary`).
 *
 * CSV eksport ATAYLAB yoʻq: eksport ham audit jurnaliga tushishi shart
 * (X-13), shuning uchun u keyin backend endpointi orqali qilinadi —
 * brauzerda fayl yasab berish audit izini chetlab oʻtardi.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { BarChartIcon } from "@/components/ui/icons";
import { AreaLineChart } from "@/components/director/charts";
import { messageOf } from "@/components/shared/LiveSession";
import {
  fetchClasses,
  fetchOverview,
  isAtRisk,
  RISK_THRESHOLD,
  type ClassRowOut,
  type DirectorOverviewOut,
} from "@/lib/director/api";
import { fetchFinanceSummary, type FinanceSummaryOut } from "@/lib/payments/api";
import { formatSom } from "@/lib/format";

const DAYS = 30;

export default function ReportsPage() {
  const [overview, setOverview] = useState<DirectorOverviewOut | null>(null);
  const [classes, setClasses] = useState<ClassRowOut[] | null>(null);
  const [finance, setFinance] = useState<FinanceSummaryOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const [ov, cls, fin] = await Promise.allSettled([
        fetchOverview(DAYS),
        fetchClasses(),
        fetchFinanceSummary(),
      ]);
      if (ov.status === "fulfilled") setOverview(ov.value);
      if (cls.status === "fulfilled") setClasses(cls.value);
      if (fin.status === "fulfilled") setFinance(fin.value);
      if (ov.status === "rejected" && cls.status === "rejected") {
        setError(messageOf(ov.reason));
      }
      setLoading(false);
    })();
  }, []);

  const sortedClasses = [...(classes ?? [])].sort(
    (a, b) => b.average_grade - a.average_grade,
  );

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Hisobotlar va analitika</h1>
        <p className="text-sm text-foreground-muted">
          Oxirgi {DAYS} kun · har bir raqam bazadan hisoblanadi
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Oʻquvchilar"
            value={overview ? overview.total_students.toLocaleString("uz-Latn") : "—"}
            note={overview ? `${overview.total_classes} ta sinf` : "Maʼlumot kelmadi"}
          />
          <Stat
            label="Davomat foizi"
            value={overview ? `${overview.attendance_percent}%` : "—"}
            note={overview ? `${overview.lessons_conducted.toLocaleString("uz-Latn")} ta dars` : "Maʼlumot kelmadi"}
          />
          <Stat
            label="Oʻrtacha baho"
            value={
              overview && overview.average_grade > 0
                ? overview.average_grade.toFixed(1)
                : "—"
            }
            note="Barcha sinflar boʻyicha"
          />
          <Stat
            label="Toʻlov tushumi"
            value={finance ? formatSom(finance.paid) : "—"}
            note={
              finance ? `Qarzdorlik: ${formatSom(finance.debt)}` : "Maʼlumot kelmadi"
            }
          />
        </div>
      )}

      {loading ? (
        <ChartSkeleton />
      ) : overview && overview.attendance_trend.length > 0 ? (
        <Card className="animate-enter">
          <h2 className="mb-1 text-base font-semibold text-foreground">
            Davomat dinamikasi (oxirgi {DAYS} kun)
          </h2>
          <p className="mb-3 text-xs text-foreground-muted">
            Darsga kelgan oʻquvchilar ulushi — maktab boʻyicha
          </p>
          <AreaLineChart
            points={overview.attendance_trend.map((p) => ({
              label: p.date.slice(5),
              value: p.percent,
            }))}
            ariaLabel="Davomat dinamikasi"
            hint="Har bir nuqta — shu kundagi oʻrtacha davomat."
          />
        </Card>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Sinflar kesimi</h2>
          <Link
            href="/rahbar/sinflar"
            className="focus-ring rounded text-sm font-medium text-brand-dark hover:underline"
          >
            Sinf ichidagi kesim →
          </Link>
        </div>

        {loading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : sortedClasses.length === 0 ? (
          <EmptyState
            icon={<BarChartIcon className="h-5 w-5" />}
            title="Sinf maʼlumoti yoʻq"
            description="Sinflar ochilib, davomat va baho kiritila boshlagach hisobot shu yerda chiqadi."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-4 py-3">Sinf</th>
                    <th className="px-4 py-3">Sinf rahbari</th>
                    <th className="px-4 py-3 text-right">Oʻquvchilar</th>
                    <th className="px-4 py-3 text-right">Davomat</th>
                    <th className="px-4 py-3 text-right">Oʻrtacha baho</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClasses.map((cls) => (
                    <tr
                      key={cls.id}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{cls.name}</td>
                      <td className="px-4 py-3 text-foreground-muted">
                        {cls.homeroom_teacher_name ?? "—"}
                      </td>
                      <td className="num px-4 py-3 text-right text-foreground-muted">
                        {cls.student_count}
                      </td>
                      <td
                        className={`num px-4 py-3 text-right font-medium ${
                          isAtRisk(cls.attendance_percent)
                            ? "text-danger"
                            : "text-foreground"
                        }`}
                      >
                        {cls.attendance_percent}%
                      </td>
                      <td className="num px-4 py-3 text-right font-medium text-foreground">
                        {cls.average_grade > 0 ? cls.average_grade.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-4 py-2.5 text-xs text-foreground-muted">
              Davomati {RISK_THRESHOLD}% dan past sinf qizil bilan belgilanadi.
              Eksport keyingi bosqichda server orqali qoʻshiladi — har bir yuklab
              olish audit jurnaliga tushishi shart.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="animate-enter">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className="num mt-2 text-2xl font-bold text-foreground">{value}</p>
      {note && <p className="mt-1 text-xs text-foreground-muted">{note}</p>}
    </Card>
  );
}
