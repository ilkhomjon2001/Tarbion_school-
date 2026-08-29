import { BellIcon } from "@/components/ui/icons";
import { GlobalSearch } from "@/components/ui/GlobalSearch";
import { DEMO_DIRECTOR } from "@/lib/director/data";
import type { SearchIndexItem } from "@/lib/search";

export function DirectorTopbar({ searchIndex }: { searchIndex: SearchIndexItem[] }) {
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
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {initials(DEMO_DIRECTOR.fullName)}
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-medium text-foreground">
              {DEMO_DIRECTOR.shortName}
            </span>
            <span className="block truncate text-xs text-foreground-muted">
              {DEMO_DIRECTOR.role}
            </span>
          </span>
        </div>
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
