"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  CalendarIcon,
  CheckSquareIcon,
  ClipboardIcon,
  HomeIcon,
  StarIcon,
} from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/student", label: "Bosh sahifa", icon: HomeIcon },
  { href: "/student/schedule", label: "Jadval", icon: CalendarIcon },
  { href: "/student/homework", label: "Vazifalar", icon: ClipboardIcon },
  { href: "/student/tests", label: "Testlar", icon: CheckSquareIcon },
  { href: "/student/grades", label: "Baholar", icon: StarIcon },
  { href: "/student/announcements", label: "Eʼlonlar", icon: BellIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-3xl overflow-x-auto">
        {NAV_ITEMS.map(({ href, label, icon: ItemIcon }) => {
          const isActive =
            href === "/student" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1 min-w-[64px]">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${
                  isActive
                    ? "text-brand"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <ItemIcon className="h-5 w-5" />
                <span className="text-center leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
