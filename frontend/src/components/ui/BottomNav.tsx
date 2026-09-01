"use client";

import Link from "next/link";

import { NavBadge } from "@/components/shared/NavBadge";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  CheckSquareIcon,
  ClipboardIcon,
  HomeIcon,
  StarIcon,
} from "@/components/ui/icons";

/**
 * Telefonda pastki menyu — kundalik 5 ta amal (O21: 7 ta band 360px
 * ekranga sigʻmasdi va surishga majbur qilardi). Eʼlonlar bosh
 * sahifadagi havola va katta ekrandagi yon menyu orqali ochiladi.
 */
const NAV_ITEMS = [
  { href: "/student", label: "Bosh sahifa", icon: HomeIcon },
  { href: "/student/schedule", label: "Jadval", icon: CalendarIcon },
  { href: "/student/homework", label: "Vazifalar", icon: ClipboardIcon },
  { href: "/student/tests", label: "Testlar", icon: CheckSquareIcon },
  { href: "/student/grades", label: "Baholar", icon: StarIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-3xl">
        {NAV_ITEMS.map(({ href, label, icon: ItemIcon }) => {
          const isActive =
            href === "/student" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`focus-ring-inset relative flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? "text-brand" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 top-0 h-0.5 rounded-b-full bg-brand"
                  />
                )}
                <ItemIcon
                  className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`}
                />
                <span className="text-center leading-tight">{label}</span>
                <NavBadge section={href} floating />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
