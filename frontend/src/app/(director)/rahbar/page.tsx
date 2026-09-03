"use client";

/**
 * Rahbariyat bosh sahifasi — BAZADAN (DIR-01).
 *
 * Moliya bloki ham serverdan (`payments/summary`, O18) — toʻlov moduli
 * ulangani uchun endi haqiqiy tushum va qarzdorlik koʻrsatiladi.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ChartSkeleton, Skeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import {
  CheckSquareIcon,
  GraduationCapIcon,
  MessageSquareIcon,
  StarIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { AreaLineChart } from "@/components/director/charts";
import { messageOf } from "@/components/shared/LiveSession";
import { fetchSummary } from "@/lib/appeals/api";
import { fetchOverview, type DirectorOverviewOut } from "@/lib/director/api";
import { fetchFinanceSummary, type FinanceSummaryOut } from "@/lib/payments/api";
import { formatSom } from "@/lib/format";

const PERIODS = [7, 30, 90] as const;

export default function DirectorHomePage() {
  const [days, setDays] = useState<number>(30);
  const [overview, setOverview] = useState<DirectorOverviewOut | null>(null);
  const [openAppeals, setOpenAppeals] = useState<number | null>(null);
  const [finance, setFinance] = useState<FinanceSummaryOut | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (period: number) => {
    setOverview(null);
    setError("");
    try {
      const [data, appeals, fin] = await Promise.all([
        fetchOverview(period),
        fetchSummary().catch(() => null),
        fetchFinanceSummary().catch(() => null),
      ]);
      setOverview(data);
      setOpenAppeals(appeals ? appeals.new + appeals.open : null);
      setFinance(fin);
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    void load(30);
  }, [load]);

  // Davomat qamrovi: jadvaldagi darslarning necha foizida davomat
  // belgilangan. Foizning ishonchliligi shunga bogʻliq.
  const qamrov =
    overview && overview.lessons_planned > 0
      ? Math.round((overview.lessons_with_attendance / overview.lessons_planned) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Umumiy koʻrsatkichlar</h1>
          <p className="text-sm text-foreground-muted">
            Oxirgi {days} kun · har bir raqam bazadan hisoblanadi
          </p>
        </div>

        <div
          role="group"
          aria-label="Hisobot davri"
          className="flex gap-1 rounded-lg border border-border bg-surface p-1 shadow-sm"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => {
                setDays(p);
                void load(p);
              }}
              className={`focus-ring rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                days === p
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {p} kun
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {overview === null ? (
        <KpiSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            index={0}
            icon={<UsersIcon className="h-5 w-5" />}
            label="Jami oʻquvchilar"
            value={overview.total_students.toLocaleString("uz-Latn")}
            note={`${overview.total_classes} ta sinf`}
          />
          <KpiCard
            index={1}
            icon={<GraduationCapIcon className="h-5 w-5" />}
            label="Jami oʻqituvchilar"
            value={String(overview.total_teachers)}
            note={`Oxirgi ${days} kun ichida darsi bor`}
            href="/rahbar/ustozlar"
          />
          {/* Foiz nechta yozuvdan chiqqani KOʻRINSIN: 48 ta yozuvdan
              hisoblangan «92%» bilan 10 000 tadan hisoblangani bir xil
              ishonch bermaydi, ekranda esa ikkalasi bir xil koʻrinardi. */}
          <KpiCard
            index={2}
            icon={<UsersIcon className="h-5 w-5" />}
            label="Davomat foizi"
            value={`${overview.attendance_percent}%`}
            note={
              overview.attendance_records === 0
                ? "Hali davomat belgilanmagan"
                : `${overview.attendance_records.toLocaleString("uz-Latn")} ta yozuv · ${qamrov}% darsda belgilangan`
            }
            noteTone={qamrov < 50 ? "warning" : "neutral"}
            href="/rahbar/sinflar"
          />
          <KpiCard
            index={3}
            icon={<StarIcon className="h-5 w-5" />}
            label="Oʻrtacha ball"
            value={overview.average_grade > 0 ? overview.average_grade.toFixed(1) : "—"}
            note="Barcha sinflar boʻyicha"
          />
          {/* Ilgari bu katak jadvaldagi darslarni sanab «Oʻtilgan
              darslar» deb koʻrsatardi. Jadvalda turgani dars
              oʻtilganini bildirmaydi — oʻtilganining yagona izi
              davomat belgilanishi. Endi ikkala son ham koʻrinadi. */}
          <KpiCard
            index={4}
            icon={<CheckSquareIcon className="h-5 w-5" />}
            label="Oʻtilgan darslar"
            value={overview.lessons_with_attendance.toLocaleString("uz-Latn")}
            note={`Jadvalda ${overview.lessons_planned.toLocaleString("uz-Latn")} ta · oxirgi ${days} kun`}
          />
          <KpiCard
            index={5}
            icon={<MessageSquareIcon className="h-5 w-5" />}
            label="Ochiq murojaatlar"
            value={openAppeals === null ? "—" : String(openAppeals)}
            note={
              openAppeals && openAppeals > 0 ? "Javob kutilmoqda" : "Hammasiga javob berilgan"
            }
            noteTone={openAppeals && openAppeals > 0 ? "warning" : "success"}
            href="/rahbar/murojaatlar"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {overview === null ? (
          <ChartSkeleton />
        ) : (
          <Card className="animate-enter">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              Davomat dinamikasi (oxirgi {days} kun)
            </h2>
            <p className="mb-3 text-xs text-foreground-muted">
              Darsga kelgan oʻquvchilar ulushi — maktab boʻyicha
            </p>
            {overview.attendance_trend.length === 0 ? (
              <p className="py-8 text-center text-sm text-foreground-muted">
                Bu davrda davomat belgilanmagan.
              </p>
            ) : (
              <AreaLineChart
                points={overview.attendance_trend.map((p) => ({
                  label: p.date.slice(5),
                  value: p.percent,
                }))}
                ariaLabel="Davomat dinamikasi"
                hint="Har bir nuqta — shu kundagi oʻrtacha davomat."
              />
            )}
          </Card>
        )}

        <Card className="animate-enter h-fit">
          <h2 className="mb-2 text-base font-semibold text-foreground">Moliya</h2>
          {finance === null ? (
            <p className="text-sm text-foreground-muted">
              Toʻlov jamlanmasini olib boʻlmadi.
            </p>
          ) : (
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-muted">Tushum</dt>
                <dd className="num font-semibold text-foreground">
                  {formatSom(finance.paid)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-muted">Hisoblangan</dt>
                <dd className="num font-medium text-foreground">
                  {formatSom(finance.charged)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-muted">Qarzdorlik</dt>
                <dd
                  className={`num font-semibold ${
                    finance.debt > 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {formatSom(finance.debt)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-foreground-muted">Qarzdorlar</dt>
                <dd className="num font-medium text-foreground">
                  {finance.debtors} nafar
                </dd>
              </div>
            </dl>
          )}
          <Link
            href="/rahbar/tolovlar"
            className="focus-ring mt-3 inline-block rounded text-sm font-medium text-brand-dark hover:underline"
          >
            Toʻlovlar boʻlimini ochish →
          </Link>
        </Card>
      </div>
    </div>
  );
}

const NOTE_TONE_CLASSES = {
  neutral: "text-foreground-muted",
  success: "text-success",
  warning: "text-warning",
} as const;

function KpiCard({
  icon,
  label,
  value,
  note,
  noteTone = "neutral",
  href,
  index = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  noteTone?: keyof typeof NOTE_TONE_CLASSES;
  href?: string;
  index?: number;
}) {
  const body = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-foreground-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand-dark transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
          {icon}
        </span>
      </div>
      <p className="num text-2xl font-bold text-foreground">{value}</p>
      {note && <p className={`mt-1 text-xs ${NOTE_TONE_CLASSES[noteTone]}`}>{note}</p>}
    </>
  );

  const style = { animationDelay: `${index * 40}ms` };

  if (!href) {
    return (
      <Card className="animate-enter" style={style}>
        {body}
      </Card>
    );
  }

  return (
    <Link
      href={href}
      style={style}
      className="animate-enter card-interactive focus-ring group block rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      {body}
    </Link>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
      <Card className="sm:col-span-2 xl:col-span-3">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-2 h-8 w-56" />
        <Skeleton className="mt-3 h-3 w-full" />
      </Card>
    </div>
  );
}
