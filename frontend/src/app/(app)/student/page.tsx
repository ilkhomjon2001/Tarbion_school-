import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { AnnouncementItem } from "@/components/features/student/AnnouncementItem";
import { LessonRow } from "@/components/features/student/LessonRow";
import { GRADE_TYPE_LABELS } from "@/lib/labels";
import {
  getCurrentStudent,
  getLatestAnnouncements,
  getRecentGrades,
  getTodayLessons,
} from "@/lib/mock/fetchers";

export default function StudentHomePage() {
  return (
    <>
      <Header title="Bosh sahifa" />
      <div className="flex flex-col gap-5 p-4">
        <Suspense fallback={<Card className="h-14 animate-pulse" />}>
          <WelcomeCard />
        </Suspense>

        <section>
          <SectionTitle title="Bugungi darslar" href="/student/schedule" />
          <Suspense fallback={<ListSkeleton count={3} />}>
            <TodayLessons />
          </Suspense>
        </section>

        <section>
          <SectionTitle title="Soʻnggi baholar" href="/student/grades" />
          <Suspense fallback={<ListSkeleton count={2} />}>
            <RecentGrades />
          </Suspense>
        </section>

        <section>
          <SectionTitle title="Yangi eʼlonlar" href="/student/announcements" />
          <Suspense fallback={<ListSkeleton count={2} />}>
            <LatestAnnouncements />
          </Suspense>
        </section>
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
        Barchasi
      </Link>
    </div>
  );
}

async function WelcomeCard() {
  const student = await getCurrentStudent();
  return (
    <Card className="bg-brand text-brand-foreground">
      <p className="text-sm opacity-90">Xush kelibsiz,</p>
      <p className="text-lg font-semibold">{student.fullName}</p>
      <p className="text-sm opacity-90">{student.className} sinf</p>
    </Card>
  );
}

async function TodayLessons() {
  const lessons = await getTodayLessons();
  if (lessons.length === 0) {
    return <EmptyState title="Bugun dars yoʻq" description="Dam olishdan bahramand boʻling." />;
  }
  return (
    <div className="flex flex-col gap-2">
      {lessons.map((lesson) => (
        <LessonRow key={lesson.id} lesson={lesson} />
      ))}
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
        <Card key={grade.id} className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {grade.subject}
            </p>
            <p className="text-xs text-foreground-muted">
              {GRADE_TYPE_LABELS[grade.type]}
            </p>
          </div>
          <span className="text-lg font-semibold text-brand-dark">
            {grade.value}
          </span>
        </Card>
      ))}
    </div>
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
        <AnnouncementItem key={item.id} announcement={item} />
      ))}
    </div>
  );
}
