import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { CheckSquareIcon } from "@/components/ui/icons";
import { AnnouncementItem } from "@/components/features/student/AnnouncementItem";
import { LessonTimeline } from "@/components/features/student/LessonTimeline";
import { AttendanceCalendar } from "@/components/features/student/AttendanceCalendar";
import { RankingList } from "@/components/features/student/RankingList";
import { GRADE_TYPE_LABELS } from "@/lib/labels";
import { formatDate, formatWeekday } from "@/lib/format";
import {
  getAttendanceSummary,
  getClassRanking,
  getCurrentStudent,
  getLatestAnnouncements,
  getRecentGrades,
  getTodayLessons,
} from "@/lib/mock/fetchers";

const TODAY_ISO = "2026-08-29";

export default function StudentHomePage() {
  return (
    <>
      <Header title="Bosh sahifa" />
      <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-3 lg:gap-6 lg:p-6">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Suspense fallback={<Card className="h-16 animate-pulse" />}>
            <GreetingCard />
          </Suspense>

          <Suspense fallback={<Card className="h-20 animate-pulse" />}>
            <TodayStatusCard />
          </Suspense>

          <section>
            <SectionTitle title="Bugungi dars jadvali" href="/student/schedule" />
            <Suspense fallback={<ListSkeleton count={3} />}>
              <TodayLessons />
            </Suspense>
          </section>

          <section>
            <SectionTitle title="Oylik davomat" href="/student/grades" />
            <Suspense fallback={<Skeleton className="h-72 w-full" />}>
              <MonthlyAttendance />
            </Suspense>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Oylik statistika
            </h2>
            <Suspense fallback={<Card className="h-64 animate-pulse" />}>
              <MonthlyStats />
            </Suspense>
          </section>

          <section>
            <SectionTitle title="Sinf reytingi" href="/student/reyting" />
            <Suspense fallback={<ListSkeleton count={3} />}>
              <RankingTeaser />
            </Suspense>
          </section>

          <section>
            <SectionTitle title="Soʻnggi baholar" href="/student/grades" />
            <Suspense fallback={<ListSkeleton count={2} />}>
              <RecentGrades />
            </Suspense>
          </section>

          <section>
            <SectionTitle title="Oxirgi eʼlonlar" href="/student/announcements" />
            <Suspense fallback={<ListSkeleton count={2} />}>
              <LatestAnnouncements />
            </Suspense>
          </section>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <Link
        href={href}
        className="text-xs font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        Barchasini koʻrish
      </Link>
    </div>
  );
}

async function GreetingCard() {
  const student = await getCurrentStudent();
  const firstName = student.fullName.split(" ")[0];
  return (
    <div>
      <h1 className="text-h1 font-bold text-foreground">
        Assalomu alaykum, {student.fullName}
      </h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Bugun {formatDate(TODAY_ISO)}, {formatWeekday(TODAY_ISO)}. Oʻqishlaringizga omad
        tilaymiz, {firstName}!
      </p>
    </div>
  );
}

async function TodayStatusCard() {
  const [lessons, summary] = await Promise.all([
    getTodayLessons(),
    getAttendanceSummary(),
  ]);
  return (
    <Card className="flex items-center gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-tint text-success">
        <CheckSquareIcon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Bugungi holat
        </p>
        <p className="truncate text-lg font-bold text-foreground">
          {lessons.length > 0
            ? `Bugun ${lessons.length} ta darsingiz bor`
            : "Bugun dars yoʻq"}
        </p>
        <p className="text-sm font-semibold text-success">
          {summary.monthLabel} davomati: {summary.percentPresent}%
        </p>
      </div>
    </Card>
  );
}

async function TodayLessons() {
  const lessons = await getTodayLessons();
  if (lessons.length === 0) {
    return <EmptyState title="Bugun dars yoʻq" description="Dam olishdan bahramand boʻling." />;
  }
  return (
    <Card>
      <LessonTimeline lessons={lessons} />
    </Card>
  );
}

async function MonthlyAttendance() {
  const summary = await getAttendanceSummary();
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{summary.monthLabel}</p>
        <p className="text-sm font-semibold text-brand-dark">
          {summary.percentPresent}% davomat
        </p>
      </div>
      <AttendanceCalendar
        year={2026}
        monthIndex={7}
        days={summary.days}
        todayIso={TODAY_ISO}
      />
    </Card>
  );
}

async function MonthlyStats() {
  const summary = await getAttendanceSummary();
  const counts = { present: 0, absent: 0, other: 0 };
  for (const day of summary.days) {
    if (day.status === "present") counts.present += 1;
    else if (day.status === "absent") counts.absent += 1;
    else counts.other += 1;
  }
  return (
    <Card>
      <ProgressRing percent={summary.percentPresent} label="Davomat" />
      <div className="mt-4 flex flex-col gap-2 text-sm">
        <StatRow dotClassName="bg-success" label="Bor" value={`${counts.present} kun`} />
        <StatRow dotClassName="bg-danger" label="Yoʻq" value={`${counts.absent} kun`} />
        <StatRow
          dotClassName="bg-warning"
          label="Sababli/Kechikdi"
          value={`${counts.other} kun`}
        />
      </div>
    </Card>
  );
}

function StatRow({
  dotClassName,
  label,
  value,
}: {
  dotClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-foreground-muted">
        <span className={`h-2 w-2 rounded-full ${dotClassName}`} />
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

async function RecentGrades() {
  const grades = await getRecentGrades(3);
  if (grades.length === 0) {
    return <EmptyState title="Hozircha baho yoʻq" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {grades.map((grade) => (
        <Link
          key={grade.id}
          href={`/student/grades/${grade.id}`}
          className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <div>
            <p className="text-sm font-medium text-foreground">{grade.subject}</p>
            <p className="text-xs text-foreground-muted">
              {GRADE_TYPE_LABELS[grade.type]}
            </p>
          </div>
          <Badge tone="brand">{grade.value}</Badge>
        </Link>
      ))}
    </div>
  );
}

async function RankingTeaser() {
  const entries = await getClassRanking();
  const top = entries.slice(0, 3);
  const currentUser = entries.find((entry) => entry.isCurrentUser);
  const currentUserInTop = top.some((entry) => entry.isCurrentUser);
  return (
    <RankingList
      entries={currentUserInTop || !currentUser ? top : [...top, currentUser]}
    />
  );
}

async function LatestAnnouncements() {
  const items = await getLatestAnnouncements(2);
  if (items.length === 0) {
    return <EmptyState title="Yangi eʼlon yoʻq" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <AnnouncementItem key={item.id} announcement={item} compact />
      ))}
    </div>
  );
}
