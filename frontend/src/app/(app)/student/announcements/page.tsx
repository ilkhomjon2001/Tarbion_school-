import { Suspense } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { AnnouncementItem } from "@/components/features/student/AnnouncementItem";
import { getAnnouncements } from "@/lib/mock/fetchers";

export default function AnnouncementsPage() {
  return (
    <>
      <Header title="Eʼlonlar" />
      <div className="flex flex-col gap-2 p-4">
        <Suspense fallback={<ListSkeleton count={3} />}>
          <AnnouncementsContent />
        </Suspense>
      </div>
    </>
  );
}

async function AnnouncementsContent() {
  const items = await getAnnouncements();
  if (items.length === 0) {
    return <EmptyState title="Hozircha eʼlon yoʻq" />;
  }
  return (
    <>
      {items.map((item) => (
        <AnnouncementItem key={item.id} announcement={item} />
      ))}
    </>
  );
}
