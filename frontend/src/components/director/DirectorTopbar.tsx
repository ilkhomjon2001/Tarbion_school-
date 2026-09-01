"use client";

import { NotificationBell } from "@/components/shared/NotificationBell";
import { GlobalSearch } from "@/components/ui/GlobalSearch";
import { currentRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import type { SearchIndexItem } from "@/lib/search";
import { getUser } from "@/lib/session";

export function DirectorTopbar({ searchIndex }: { searchIndex: SearchIndexItem[] }) {
  // Ism SESSIYADAN (O17) — avval bu yerda demo direktor turardi.
  const fullName = getUser()?.full_name ?? "—";
  const role = currentRole();
  return (
    <header className="sticky top-0 z-20 hidden items-center gap-4 border-b border-border bg-surface/95 px-6 py-3 backdrop-blur md:flex">
      <GlobalSearch
        index={searchIndex}
        className="w-full max-w-xs"
        inputClassName="w-full rounded-lg border border-border bg-surface-muted py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      />

      <div className="ml-auto flex items-center gap-3">
        <NotificationBell />
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {initials(fullName)}
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-medium text-foreground">
              {fullName}
            </span>
            <span className="block truncate text-xs text-foreground-muted">
              {role ? ROLE_LABELS[role] : "Rahbariyat"}
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
