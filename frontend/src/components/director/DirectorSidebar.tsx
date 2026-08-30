"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  BarChartIcon,
  GraduationCapIcon,
  GridIcon,
  CalendarIcon,
  ClockIcon,
  LogoutIcon,
  MessageSquareIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/rahbar", label: "Bosh sahifa", icon: GridIcon },
  { href: "/rahbar/jadval", label: "Dars jadvali", icon: CalendarIcon },
  { href: "/rahbar/sinflar", label: "Sinflar", icon: UsersIcon },
  { href: "/rahbar/murojaatlar", label: "Murojaatlar", icon: MessageSquareIcon },
  { href: "/rahbar/ustozlar", label: "Ustozlar", icon: GraduationCapIcon },
  { href: "/rahbar/tolovlar", label: "Toʻlovlar", icon: WalletIcon },
  { href: "/rahbar/hisobotlar", label: "Hisobotlar", icon: BarChartIcon },
  { href: "/rahbar/jonli", label: "Jonli hisobot", icon: ClockIcon },
] as const;

export function DirectorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface md:flex">
      <div className="px-5 py-5">
        <BrandLogo variant="wordmark" className="h-6 w-auto" subtitle="Rahbariyat kabineti" priority />
      </div>

      <nav aria-label="Asosiy navigatsiya" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: ItemIcon }) => {
            const isActive = href === "/rahbar" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`focus-ring relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-tint text-brand-dark"
                      : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {/* Faol bandning chap chetidagi belgi — rang koʻrmaydiganlar
                      uchun ham holat koʻrinib tursin */}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand"
                    />
                  )}
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
          href="/login"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          Chiqish
        </Link>
      </div>
    </aside>
  );
}
