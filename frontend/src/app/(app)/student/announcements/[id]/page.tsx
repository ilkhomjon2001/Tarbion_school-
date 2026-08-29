import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { formatDate } from "@/lib/format";
import { getAnnouncementById } from "@/lib/mock/fetchers";

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const announcement = await getAnnouncementById(id);

  if (!announcement) {
    notFound();
  }

  return (
    <>
      <Header title="Eʼlon" backHref="/student/announcements" />
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge tone={announcement.audience === "school" ? "brand" : "info"}>
              {announcement.audience === "school" ? "Butun maktab" : "Sinf"}
            </Badge>
            <span className="text-xs text-foreground-muted">
              {formatDate(announcement.publishedAt)}
            </span>
          </div>
          <h2 className="text-base font-semibold text-foreground">
            {announcement.title}
          </h2>
          <p className="mt-2 text-sm text-foreground-muted">{announcement.body}</p>
        </Card>
      </div>
    </>
  );
}
