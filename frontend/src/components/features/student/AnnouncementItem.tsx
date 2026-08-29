import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import type { Announcement } from "@/lib/types";

export function AnnouncementItem({
  announcement,
}: {
  announcement: Announcement;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Badge tone={announcement.audience === "school" ? "brand" : "info"}>
          {announcement.audience === "school" ? "Butun maktab" : "Sinf"}
        </Badge>
        <span className="text-xs text-foreground-muted">
          {formatDate(announcement.publishedAt)}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-foreground">
        {announcement.title}
      </h3>
      <p className="mt-1 text-sm text-foreground-muted">{announcement.body}</p>
    </article>
  );
}
