import { Suspense } from "react";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { HomeworkFilterList } from "@/components/features/student/HomeworkFilterList";
import { getHomeworkList } from "@/lib/mock/fetchers";

export default function HomeworkPage() {
  return (
    <>
      <Header title="Uy vazifasi" />
      <div className="p-4">
        <Suspense fallback={<ListSkeleton count={4} />}>
          <HomeworkContent />
        </Suspense>
      </div>
    </>
  );
}

async function HomeworkContent() {
  const items = await getHomeworkList();
  return <HomeworkFilterList items={items} />;
}
