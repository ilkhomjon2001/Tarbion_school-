import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import type { Announcement } from "@/lib/types";

export function AnnouncementItem({
  announcement,
  compact = false,
}: {
  announcement: Announcement;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/student/announcements/${announcement.id}`}
      className={`block rounded-xl border border-border bg-surface transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${compact ? "p-3" : "p-4"}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Badge tone={announcement.audience === "school" ? "brand" : "info"}>
          {announcement.audience === "school" ? "Butun maktab" : "Sinf"}
        </Badge>
        <span className="text-xs text-foreground-muted">
          {formatDate(announcement.publishedAt)}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-foreground">{announcement.title}</h3>
      <p
        className={`mt-1 text-sm text-foreground-muted ${compact ? "line-clamp-2" : ""}`}
      >
        {announcement.body}
      </p>
    </Link>
  );
}
