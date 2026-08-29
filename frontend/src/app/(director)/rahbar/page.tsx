import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { AlertTriangleIcon, GraduationCapIcon, InfoIcon, UsersIcon, WalletIcon } from "@/components/ui/icons";
import { AreaLineChart } from "@/components/director/charts";
import { formatSom } from "@/lib/format";
import { getDirectorOverview } from "@/lib/director/fetchers";
import type { AlertLevel } from "@/lib/director/types";

export default function DirectorHomePage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Umumiy koʻrsatkichlar</h1>
        <p className="text-sm text-foreground-muted">Maktab boʻyicha bugungi holat</p>
      </div>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiRow />
      </Suspense>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Suspense fallback={<Card className="h-72 animate-pulse" />}>
          <AttendanceCard />
        </Suspense>

        <div className="flex flex-col gap-5">
          <Suspense fallback={<Card className="h-40 animate-pulse" />}>
            <AlertsCard />
          </Suspense>
          <Suspense fallback={<Card className="h-40 animate-pulse" />}>
            <AnnouncementsCard />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function KpiRow() {
  const overview = await getDirectorOverview();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={<UsersIcon className="h-5 w-5" />}
        label="Jami oʻquvchilar"
        value={overview.totalStudents.toLocaleString("uz-Latn")}
        note={`↗ +${overview.studentGrowthPercent}% oylik oʻsish`}
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
        label="Bugungi davomat foizi"
        value={`${overview.todayAttendancePercent}%`}
      />
      <KpiCard
        icon={<WalletIcon className="h-5 w-5" />}
        label="Oylik toʻlov tushumi"
        value={formatSom(overview.monthlyRevenue)}
        note={`↑ Kutilganidan ${overview.revenueVsPlanPercent}% koʻp`}
        noteTone="success"
        valueClassName="text-lg sm:text-xl"
      />
    </div>
  );
}

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
  noteTone?: "neutral" | "success";
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
      <p className={`font-bold text-foreground ${valueClassName}`}>{value}</p>
      {note && (
        <p className={`mt-1 text-xs ${noteTone === "success" ? "text-success" : "text-foreground-muted"}`}>
          {note}
        </p>
      )}
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="h-28 animate-pulse" />
      ))}
    </div>
  );
}

async function AttendanceCard() {
  const overview = await getDirectorOverview();
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Davomat dinamikasi (oxirgi 30 kun)
        </h2>
      </div>
      <AreaLineChart
        points={overview.attendanceTrend.map((p) => ({ label: p.dateLabel, value: p.percent }))}
      />
    </Card>
  );
}

const ALERT_TONE: Record<AlertLevel, { badge: "danger" | "warning" | "info"; border: string }> = {
  danger: { badge: "danger", border: "border-l-danger" },
  warning: { badge: "warning", border: "border-l-warning" },
  info: { badge: "info", border: "border-l-info" },
};

async function AlertsCard() {
  const overview = await getDirectorOverview();
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
              className={`rounded-lg border-l-4 bg-surface-muted p-3 ${ALERT_TONE[alert.level].border}`}
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
