"use client";

/**
 * Jonli hisobot — barcha raqam BAZADAN.
 *
 * Nega alohida sahifa: qolgan rahbariyat sahifalari (davomat, baho,
 * imtihon) hali mock ustida ishlaydi va ular maktab rahbariga
 * koʻrsatiladi — hammasini bir kechada koʻchirish prototipni ishlamay
 * qoldirardi. Sahifalar bittalab koʻchiriladi; murojaatlar allaqachon
 * oʻtdi (`components/shared/LiveAppeals.tsx`).
 *
 * Sessiya (kirish, tokenni tiklash, 401) shu yerda emas —
 * `components/shared/LiveSession.tsx` da, barcha kabinetlar uchun bir xil.
 *
 * Maʼlumot MIJOZ tomonida olinadi: token brauzer xotirasida, Server
 * Component uni koʻrmaydi. Bu tasodifiy emas — DECISIONS.md da BFF
 * qilmaslik qarori qabul qilingan, brauzer to‘g‘ridan-to‘g‘ri API ga
 * murojaat qiladi.
 *
 * Moliya koʻrsatkichlari bu yerda YOʻQ: bazada `payments` jadvali hali
 * yaratilmagan. Nol koʻrsatish «qarzdorlik yoʻq» degan yolgʻon boʻlardi.
 */

import { useCallback, useEffect, useState } from "react";
import { AreaLineChart, type TrendPoint } from "@/components/director/charts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertTriangleIcon } from "@/components/ui/icons";
import { directorClasses, directorOverview, directorTeachers } from "@/lib/api/sdk.gen";
import type { ClassRowOut, DirectorOverviewOut, TeacherRowOut } from "@/lib/api/types.gen";
import { LiveSession, messageOf } from "@/components/shared/LiveSession";
import { getUser, withAuth } from "@/lib/session";

interface Loaded {
  overview: DirectorOverviewOut;
  classes: ClassRowOut[];
  teachers: TeacherRowOut[];
}

type Phase = "loading" | "ready" | "failed";

export function LiveReports() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <LiveSession
        title="Jonli hisobot"
        hint="Backend ishga tushmagan boʻlsa bu sahifa boʻsh qoladi — qolgan rahbariyat boʻlimlari mustaqil ishlaydi."
      >
        {(reloadKey) => <Reports key={reloadKey} />}
      </LiveSession>
    </div>
  );
}

function Reports() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string>("");
  const [days, setDays] = useState(30);

  const load = useCallback(async (period: number) => {
    setPhase("loading");
    setError("");
    try {
      const [overview, classes, teachers] = await Promise.all([
        withAuth(() => directorOverview({ query: { days: period } })),
        withAuth(() => directorClasses()),
        withAuth(() => directorTeachers()),
      ]);
      setData({ overview, classes, teachers });
      setPhase("ready");
    } catch (err) {
      setError(messageOf(err));
      setPhase("failed");
    }
  }, []);

  useEffect(() => {
    void load(days);
    // Faqat bir marta — davr tugmasi `load` ni oʻzi chaqiradi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Jonli hisobot</h1>
          <p className="text-sm text-foreground-muted">
            Bu sahifadagi har bir raqam bazadan hisoblanadi
            {getUser() ? ` · ${getUser()!.short_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[7, 30, 90].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setDays(option);
                void load(option);
              }}
              aria-pressed={days === option}
              className={`focus-ring rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                days === option
                  ? "bg-brand text-brand-foreground"
                  : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {option} kun
            </button>
          ))}
        </div>
      </header>

      {phase === "failed" && (
        <EmptyState
          icon={<AlertTriangleIcon className="h-5 w-5" />}
          title="Maʼlumot olinmadi"
          description={error}
          action={
            <button
              type="button"
              onClick={() => load(days)}
              className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
            >
              Qayta urinish
            </button>
          }
        />
      )}

      {phase === "loading" && !data && (
        <p className="text-sm text-foreground-muted">Yuklanmoqda…</p>
      )}

      {data && (
        <>
          <div
            className={`grid grid-cols-2 gap-4 lg:grid-cols-4 ${
              phase === "loading" ? "opacity-60" : ""
            }`}
          >
            <Stat label="Oʻquvchilar" value={data.overview.total_students} />
            <Stat label="Ustozlar" value={data.overview.total_teachers} hint="darsi bor xodimlar" />
            <Stat
              label="Davomat"
              value={`${data.overview.attendance_percent}%`}
              hint={`${data.overview.lessons_conducted} ta dars boʻyicha`}
            />
            <Stat
              label="Oʻrtacha baho"
              value={data.overview.average_grade}
              hint={`${data.overview.total_classes} ta sinf`}
            />
          </div>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-foreground">Davomat dinamikasi</h2>
            <AreaLineChart
              points={toPoints(data.overview.attendance_trend)}
              hint="Kunlik davomat foizi — kelgan (kechikkan ham) oʻquvchilar ulushi"
              ariaLabel="Kunlik davomat dinamikasi"
            />
          </Card>

          <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <h2 className="border-b border-border px-4 py-3 text-base font-semibold text-foreground">
              Sinflar kesimi
            </h2>
            <div className="scroll-x">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-3">Sinf</th>
                    <th className="px-3 py-3">Oʻquvchi</th>
                    <th className="px-3 py-3">Davomat</th>
                    <th className="px-3 py-3">Oʻrtacha baho</th>
                    <th className="px-3 py-3">Sinf rahbari</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">{row.name}</td>
                      <td className="num px-3 py-2.5 text-foreground-muted">
                        {row.student_count}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`num ${toneOf(row.attendance_percent)}`}>
                          {row.attendance_percent}%
                        </span>
                      </td>
                      <td className="num px-3 py-2.5 text-foreground-muted">
                        {row.average_grade}
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">
                        {row.homeroom_teacher_name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <h2 className="border-b border-border px-4 py-3 text-base font-semibold text-foreground">
              Ustozlar faoliyati
            </h2>
            <div className="scroll-x">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                    <th className="px-3 py-3">Ustoz</th>
                    <th className="px-3 py-3">Haftalik soat</th>
                    <th className="px-3 py-3">Oʻtilgan dars</th>
                    <th className="px-3 py-3">Qoʻyilgan baho</th>
                    <th className="px-3 py-3">Rahbarlik</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teachers.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5">
                        <span className="block font-medium text-foreground">{row.full_name}</span>
                        <span className="block text-xs text-foreground-muted">
                          {row.subjects.join(", ") || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="num text-foreground-muted">{row.weekly_hours}</span>
                        {row.weekly_hours > 24 && (
                          <span className="ml-2 align-middle">
                            <Badge tone="danger">Ortiqcha</Badge>
                          </span>
                        )}
                      </td>
                      <td className="num px-3 py-2.5 text-foreground-muted">
                        {row.lessons_conducted}
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">
                        <span className="num">{row.grades_given}</span> ta · oʻrtacha{" "}
                        <span className="num">{row.average_grade_given}</span>
                      </td>
                      <td className="px-3 py-2.5 text-foreground-muted">
                        {row.homeroom_class_name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
              Roʻyxat rol boʻyicha emas, DARSI boʻyicha quriladi: dars yuklamasi
              biriktirilmagan xodim bu yerda koʻrinmaydi.
            </p>
          </section>

          <p className="text-xs text-foreground-muted">
            Toʻlov, tushum va qarzdorlik koʻrsatkichlari bu sahifada yoʻq — bazada
            moliya jadvallari hali yaratilmagan. Nol koʻrsatish notoʻgʻri xulosaga
            olib kelardi.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="animate-enter">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className="num mt-1 text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-foreground-muted">{hint}</p>}
    </Card>
  );
}

function toPoints(trend: DirectorOverviewOut["attendance_trend"]): TrendPoint[] {
  return trend.map((point) => ({
    // "2026-09-18" → "18.09"
    label: point.date.slice(5).split("-").reverse().join("."),
    value: point.percent,
  }));
}

function toneOf(percent: number): string {
  if (percent >= 90) return "text-success";
  if (percent >= 80) return "text-warning";
  return "text-danger";
}
