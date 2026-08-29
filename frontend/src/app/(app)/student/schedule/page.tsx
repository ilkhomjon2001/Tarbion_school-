import { Suspense } from "react";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ScheduleTabs } from "@/components/features/student/ScheduleTabs";
import { getSchedule } from "@/lib/mock/fetchers";

export default function SchedulePage() {
  return (
    <>
      <Header title="Dars jadvali" />
      <div className="p-4">
        <Suspense fallback={<ListSkeleton count={4} />}>
          <ScheduleContent />
        </Suspense>
      </div>
    </>
  );
}

async function ScheduleContent() {
  const entries = await getSchedule();
  return <ScheduleTabs entries={entries} />;
}
