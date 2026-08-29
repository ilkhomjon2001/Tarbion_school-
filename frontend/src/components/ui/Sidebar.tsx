"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { logout } from "@/lib/auth";
import {
  BellIcon,
  CalendarIcon,
  CheckSquareIcon,
  ClipboardIcon,
  HomeIcon,
  LogoutIcon,
  StarIcon,
  TrophyIcon,
  UtensilsIcon,
} from "@/components/ui/icons";
import type { Student } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/student", label: "Bosh sahifa", icon: HomeIcon },
  { href: "/student/schedule", label: "Jadval", icon: CalendarIcon },
  { href: "/student/homework", label: "Uy vazifasi", icon: ClipboardIcon },
  { href: "/student/tests", label: "Testlar", icon: CheckSquareIcon },
  { href: "/student/grades", label: "Baholar", icon: StarIcon },
  { href: "/student/reyting", label: "Reyting", icon: TrophyIcon },
  { href: "/student/oshxona", label: "Oshxona", icon: UtensilsIcon },
  { href: "/student/announcements", label: "Eʼlonlar", icon: BellIcon },
] as const;

export function Sidebar({ student }: { student: Student }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface md:flex">
      <div className="px-5 py-5">
        <BrandLogo variant="wordmark" className="h-6 w-auto" subtitle="Oʻquvchi kabineti" priority />
      </div>

      <nav aria-label="Asosiy navigatsiya" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: ItemIcon }) => {
            const isActive =
              href === "/student" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                    isActive
                      ? "bg-brand-tint text-brand-dark"
                      : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <ItemIcon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/student/profil"
          className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
            {initials(student.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {student.fullName}
            </p>
            <p className="truncate text-xs text-foreground-muted">
              {student.className} sinf
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          Chiqish
        </button>
      </div>
    </aside>
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
