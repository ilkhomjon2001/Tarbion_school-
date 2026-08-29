"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  BarChartIcon,
  BellIcon,
  CalendarIcon,
  GraduationCapIcon,
  GridIcon,
  LogoutIcon,
  MenuIcon,
  MessageSquareIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from "@/components/ui/icons";
import { GlobalSearch } from "@/components/ui/GlobalSearch";
import { DEMO_DIRECTOR } from "@/lib/director/data";
import type { SearchIndexItem } from "@/lib/search";

const NAV_ITEMS = [
  { href: "/rahbar", label: "Bosh sahifa", icon: GridIcon },
  { href: "/rahbar/jadval", label: "Dars jadvali", icon: CalendarIcon },
  { href: "/rahbar/sinflar", label: "Sinflar", icon: UsersIcon },
  { href: "/rahbar/murojaatlar", label: "Murojaatlar", icon: MessageSquareIcon },
  { href: "/rahbar/ustozlar", label: "Ustozlar", icon: GraduationCapIcon },
  { href: "/rahbar/tolovlar", label: "Toʻlovlar", icon: WalletIcon },
  { href: "/rahbar/hisobotlar", label: "Hisobotlar", icon: BarChartIcon },
] as const;

export function DirectorMobileTopBar({ searchIndex }: { searchIndex: SearchIndexItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5 md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menyuni ochish"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <GlobalSearch
        index={searchIndex}
        className="min-w-0 flex-1"
        inputClassName="w-full min-w-0 rounded-lg border border-border bg-surface-muted py-1.5 pl-8 pr-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      />

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Bildirishnomalar"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <BellIcon className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
        </button>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
          {initials(DEMO_DIRECTOR.fullName)}
        </span>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Menyuni yopish"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/20"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-lg">
            <div className="flex items-center justify-between px-5 py-5">
              <BrandLogo variant="wordmark" className="h-6 w-auto" subtitle="Rahbariyat kabineti" />
              <button
                type="button"
                aria-label="Yopish"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-2">
              <ul className="flex flex-col gap-1">
                {NAV_ITEMS.map(({ href, label, icon: ItemIcon }) => {
                  const isActive =
                    href === "/rahbar" ? pathname === href : pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-brand-tint text-brand-dark"
                            : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                        }`}
                      >
                        <ItemIcon className="h-5 w-5 shrink-0" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-border p-3">
              <Link
                href="/login"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted hover:bg-surface-muted hover:text-danger"
              >
                <LogoutIcon className="h-5 w-5 shrink-0" />
                Chiqish
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
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
