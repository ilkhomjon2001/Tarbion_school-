import { Suspense } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { MenuDayTabs } from "@/components/features/student/MenuDayTabs";
import { getWeeklyMenu } from "@/lib/mock/fetchers";

export default function CafeteriaPage() {
  return (
    <>
      <Header title="Maktab oshxonasi" />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-foreground-muted">
          Kuniga 3 mahal ovqat beriladi: nonushta, tushlik va kechki yengil taom.
          Har kuni menyu har xil boʻladi.
        </p>
        <Suspense fallback={<ListSkeleton count={3} />}>
          <MenuContent />
        </Suspense>
      </div>
    </>
  );
}

async function MenuContent() {
  const days = await getWeeklyMenu();
  if (days.length === 0) {
    return <EmptyState title="Hozircha menyu kiritilmagan" />;
  }
  return <MenuDayTabs days={days} />;
}
