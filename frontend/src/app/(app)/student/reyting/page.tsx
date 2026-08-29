import { Suspense } from "react";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { RankingList } from "@/components/features/student/RankingList";
import { getClassRanking, getCurrentStudent } from "@/lib/mock/fetchers";

export default function RankingPage() {
  return (
    <>
      <Header title="Sinf reytingi" />
      <div className="flex flex-col gap-3 p-4">
        <Suspense fallback={<Intro />}>
          <IntroText />
        </Suspense>
        <Suspense fallback={<ListSkeleton count={5} />}>
          <RankingContent />
        </Suspense>
      </div>
    </>
  );
}

function Intro() {
  return (
    <p className="text-sm text-foreground-muted">
      Reyting oʻrtacha baho va davomat asosida hisoblanadi.
    </p>
  );
}

async function IntroText() {
  const student = await getCurrentStudent();
  return (
    <p className="text-sm text-foreground-muted">
      {student.className} sinfida oʻrtacha baho va davomat asosida hisoblangan reyting.
    </p>
  );
}

async function RankingContent() {
  const entries = await getClassRanking();
  return <RankingList entries={entries} />;
}
