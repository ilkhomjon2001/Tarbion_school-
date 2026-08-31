import Link from "next/link";

import { NotificationBell } from "@/components/shared/NotificationBell";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { GlobalSearch } from "@/components/ui/GlobalSearch";
import type { SearchIndexItem } from "@/lib/search";
import type { Student } from "@/lib/types";

export function MobileTopBar({
  student,
  searchIndex,
}: {
  student: Student;
  searchIndex: SearchIndexItem[];
}) {
  return (
    <header className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5 md:hidden">
      <BrandLogo variant="wordmark" className="h-5 w-auto shrink-0" priority />

      <GlobalSearch
        index={searchIndex}
        className="min-w-0 flex-1"
        inputClassName="w-full min-w-0 rounded-lg border border-border bg-surface-muted py-1.5 pl-8 pr-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      />

      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <Link
          href="/student/profil"
          aria-label="Profil"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground"
        >
          {initials(student.fullName)}
        </Link>
      </div>
    </header>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
