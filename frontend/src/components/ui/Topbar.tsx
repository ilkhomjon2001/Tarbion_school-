import Link from "next/link";
import { BellIcon } from "@/components/ui/icons";
import { GlobalSearch } from "@/components/ui/GlobalSearch";
import type { SearchIndexItem } from "@/lib/search";
import type { Student } from "@/lib/types";

export function Topbar({
  student,
  searchIndex,
}: {
  student: Student;
  searchIndex: SearchIndexItem[];
}) {
  return (
    <header className="sticky top-0 z-20 hidden items-center gap-4 border-b border-border bg-surface/95 px-6 py-3 backdrop-blur md:flex">
      <GlobalSearch
        index={searchIndex}
        className="w-full max-w-xs"
        inputClassName="w-full rounded-lg border border-border bg-surface-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      />

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          aria-label="Bildirishnomalar"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <BellIcon className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
        </button>
        <Link
          href="/student/profil"
          aria-label="Profil"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
