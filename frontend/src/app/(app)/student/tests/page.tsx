import { Suspense } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { TestListItem } from "@/components/features/student/TestListItem";
import { getTestList } from "@/lib/mock/fetchers";

export default function TestsPage() {
  return (
    <>
      <Header title="Testlar" />
      <div className="flex flex-col gap-2 p-4">
        <Suspense fallback={<ListSkeleton count={3} />}>
          <TestsContent />
        </Suspense>
      </div>
    </>
  );
}

async function TestsContent() {
  const tests = await getTestList();
  if (tests.length === 0) {
    return <EmptyState title="Hozircha test yoʻq" />;
  }
  return (
    <>
      {tests.map((test) => (
        <TestListItem key={test.id} test={test} />
      ))}
    </>
  );
}
