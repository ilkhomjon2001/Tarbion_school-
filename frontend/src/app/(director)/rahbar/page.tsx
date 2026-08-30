import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  AlertTriangleIcon,
  GraduationCapIcon,
  InfoIcon,
  MessageSquareIcon,
  StarIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { AreaLineChart } from "@/components/director/charts";
import { formatSom } from "@/lib/format";
import { getDirectorOverview } from "@/lib/director/fetchers";
import {
  OVERVIEW_PERIOD_LABELS,
  type AlertLevel,
  type OverviewPeriod,
} from "@/lib/director/types";

const PERIODS: OverviewPeriod[] = ["month", "year"];

function parsePeriod(value: string | undefined): OverviewPeriod {
  return value === "year" ? "year" : "month";
}

export default async function DirectorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ davr?: string }>;
}) {
  const { davr } = await searchParams;
  const period = parsePeriod(davr);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Umumiy koʻrsatkichlar</h1>
          <p className="text-sm text-foreground-muted">
            {period === "year" ? "Oʻquv yili boshidan" : "Joriy oy boʻyicha"}
          </p>
        </div>

        {/* Davr almashtirgich — sahifa qayta yuklanadi, holat URL'da qoladi */}
        <div role="group" aria-label="Hisobot davri" className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={p === "month" ? "/rahbar" : `/rahbar?davr=${p}`}
              aria-current={period === p ? "true" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                period === p
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {OVERVIEW_PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      <Suspense key={period} fallback={<KpiSkeleton />}>
        <KpiRow period={period} />
      </Suspense>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Suspense key={`chart-${period}`} fallback={<Card className="h-72 animate-pulse" />}>
          <AttendanceCard period={period} />
        </Suspense>

        <div className="flex flex-col gap-5">
          <Suspense key={`contract-${period}`} fallback={<Card className="h-40 animate-pulse" />}>
            <ContractCard period={period} />
          </Suspense>
          <Suspense key={`alerts-${period}`} fallback={<Card className="h-40 animate-pulse" />}>
            <AlertsCard period={period} />
          </Suspense>
          <Suspense fallback={<Card className="h-40 animate-pulse" />}>
            <AnnouncementsCard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function KpiRow({ period }: { period: OverviewPeriod }) {
  const overview = await getDirectorOverview(period);
  const periodLabel = period === "year" ? "oʻquv yili" : "bu oy";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        icon={<UsersIcon className="h-5 w-5" />}
        label="Jami oʻquvchilar"
        value={overview.totalStudents.toLocaleString("uz-Latn")}
        note={`↗ +${overview.studentGrowthPercent}% ${periodLabel}`}
        noteTone="success"
      />
      <KpiCard
        icon={<GraduationCapIcon className="h-5 w-5" />}
        label="Jami oʻqituvchilar"
        value={String(overview.totalTeachers)}
        note="Barcha fanlar boʻyicha"
      />
      <KpiCard
        icon={<UsersIcon className="h-5 w-5" />}
        label="Davomat foizi"
        value={`${overview.todayAttendancePercent}%`}
        note="Shu haftada"
      />
      <KpiCard
        icon={<StarIcon className="h-5 w-5" />}
        label="Oʻrtacha ball"
        value={overview.averageGrade.toFixed(1)}
        note="Barcha sinflar boʻyicha"
      />
      <KpiCard
        icon={<MessageSquareIcon className="h-5 w-5" />}
        label="Ochiq murojaatlar"
        value={String(overview.openRequestsCount)}
        note={overview.openRequestsCount > 0 ? "Javob kutilmoqda" : "Hammasiga javob berilgan"}
        noteTone={overview.openRequestsCount > 0 ? "warning" : "success"}
      />
      <KpiCard
        icon={<WalletIcon className="h-5 w-5" />}
        label={period === "year" ? "Yillik toʻlov tushumi" : "Oylik toʻlov tushumi"}
        value={formatSom(overview.revenue)}
        note={`Rejadan ${formatSom(overview.expectedRevenue)}`}
        valueClassName="text-lg sm:text-xl"
      />

      {/* Qarzdorlik — alohida, kengroq kartochka */}
      <Card className="sm:col-span-2 xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-foreground-muted">
              Qarzdorlik ({period === "year" ? "oʻquv yili" : "joriy oy"})
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span
                className={`num text-3xl font-bold ${
                  overview.debtPercent > 10 ? "text-danger" : "text-warning"
                }`}
              >
                {overview.debtPercent}%
              </span>
              <span className="num text-lg font-semibold text-foreground">
                {formatSom(overview.debtAmount)}
              </span>
            </div>
          </div>

          <div className="min-w-[200px] flex-1">
            <div className="mb-1 flex justify-between text-xs text-foreground-muted">
              <span>Yigʻilgan {100 - overview.debtPercent}%</span>
              <span>Qarz {overview.debtPercent}%</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full bg-success"
                style={{ width: `${100 - overview.debtPercent}%` }}
              />
              <div className="h-full bg-danger" style={{ width: `${overview.debtPercent}%` }} />
            </div>
          </div>

          <Link
            href="/rahbar/tolovlar"
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-brand-dark transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Batafsil koʻrish
          </Link>
        </div>
      </Card>
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
  valueClassName = "text-2xl",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  noteTone?: keyof typeof NOTE_TONE_CLASSES;
  valueClassName?: string;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-foreground-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand-dark">
          {icon}
        </span>
      </div>
      <p className={`num font-bold text-foreground ${valueClassName}`}>{value}</p>
      {note && <p className={`mt-1 text-xs ${NOTE_TONE_CLASSES[noteTone]}`}>{note}</p>}
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="h-28 animate-pulse" />
      ))}
      <Card className="h-28 animate-pulse sm:col-span-2 xl:col-span-3" />
    </div>
  );
}

async function ContractCard({ period }: { period: OverviewPeriod }) {
  const overview = await getDirectorOverview(period);
  const { contracts } = overview;

  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-foreground">Shartnoma holati</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-success-tint p-3">
          <p className="text-xs text-success/80">Yangi qoʻshildi</p>
          <p className="num mt-0.5 text-2xl font-bold text-success">+{contracts.joined}</p>
        </div>
        <div className="rounded-lg bg-danger-tint p-3">
          <p className="text-xs text-danger/80">Bekor qilindi</p>
          <p className="num mt-0.5 text-2xl font-bold text-danger">−{contracts.left}</p>
        </div>
      </div>
      <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-foreground-muted">Davr boshida</dt>
          <dd className="num font-medium text-foreground">{contracts.startCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-foreground-muted">Sof oʻsish</dt>
          <dd className={`num font-medium ${contracts.net >= 0 ? "text-success" : "text-danger"}`}>
            {contracts.net >= 0 ? "+" : ""}
            {contracts.net}
          </dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5">
          <dt className="font-medium text-foreground">Hozirgi jami</dt>
          <dd className="num font-semibold text-foreground">{contracts.current}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-foreground-muted">
        Ketgan oʻquvchi oʻchirilmaydi — arxivlanadi, hisoboti saqlanadi.
      </p>
    </Card>
  );
}

async function AttendanceCard({ period }: { period: OverviewPeriod }) {
  const overview = await getDirectorOverview(period);
  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold text-foreground">
        {period === "year" ? "Davomat dinamikasi (oʻquv yili)" : "Davomat dinamikasi (oxirgi 30 kun)"}
      </h2>
      <AreaLineChart
        points={overview.attendanceTrend.map((p) => ({ label: p.dateLabel, value: p.percent }))}
      />
    </Card>
  );
}

const ALERT_BORDER: Record<AlertLevel, string> = {
  danger: "border-l-danger",
  warning: "border-l-warning",
  info: "border-l-info",
};

async function AlertsCard({ period }: { period: OverviewPeriod }) {
  const overview = await getDirectorOverview(period);
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-foreground">Diqqat talab qiladi</h2>
      {overview.alerts.length === 0 ? (
        <p className="text-sm text-foreground-muted">Hozircha ogohlantirish yoʻq.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {overview.alerts.map((alert) => (
            <li
              key={alert.id}
              className={`rounded-lg border-l-4 bg-surface-muted p-3 ${ALERT_BORDER[alert.level]}`}
            >
              <div className="mb-1 flex items-center gap-2">
                {alert.level === "info" ? (
                  <InfoIcon className="h-4 w-4 shrink-0 text-info" />
                ) : (
                  <AlertTriangleIcon className="h-4 w-4 shrink-0 text-danger" />
                )}
                <p className="text-sm font-medium text-foreground">{alert.title}</p>
              </div>
              <p className="text-xs text-foreground-muted">{alert.description}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function AnnouncementsCard() {
  const overview = await getDirectorOverview();
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-foreground">Soʻnggi eʼlonlar</h2>
      <ul className="flex flex-col gap-4">
        {overview.announcements.map((item) => (
          <li key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-0.5 text-xs text-foreground-muted">{item.body}</p>
            <p className="mt-1 text-[11px] text-foreground-muted">{item.createdAtLabel}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
