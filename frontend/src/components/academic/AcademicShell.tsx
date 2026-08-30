"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useAccess } from "@/lib/access-api";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  BarChartIcon,
  BookOpenIcon,
  CheckSquareIcon,
  ClipboardIcon,
  GraduationCapIcon,
  GridIcon,
  LogoutIcon,
  MenuIcon,
  XIcon,
} from "@/components/ui/icons";
import { logout } from "@/lib/auth";
import { ACADEMIC_HEAD } from "@/lib/school/staff";

const SUBTITLE = "Oʻquv boʻlimi";

/**
 * Oʻquv boʻlimi navigatsiyasi. `href` ayni paytda `lib/access.ts` dagi
 * boʻlim kalitidir — super admin yashirganda shu roʻyxatdan chiqadi.
 */
export const ACADEMIC_NAV = [
  { href: "/oquv-bolim", label: "Bosh sahifa", icon: GridIcon },
  { href: "/oquv-bolim/imtihonlar", label: "Imtihonlar", icon: ClipboardIcon },
  { href: "/oquv-bolim/natijalar", label: "Natijalar", icon: BarChartIcon },
  { href: "/oquv-bolim/rejalar", label: "Dars rejalari", icon: BookOpenIcon },
  { href: "/oquv-bolim/sifat", label: "Sifat nazorati", icon: CheckSquareIcon },
  { href: "/oquv-bolim/ustozlar", label: "Ustozlar faoliyati", icon: GraduationCapIcon },
] as const;

function isActive(href: string, pathname: string): boolean {
  return href === "/oquv-bolim" ? pathname === href : pathname.startsWith(href);
}

export function AcademicSidebar() {
  const pathname = usePathname();

  // Menyu serverdan kelgan boʻlimlar boʻyicha (T-005).
  const { sections } = useAccess();
  const nav = useMemo(
    () => ACADEMIC_NAV.filter((i) => sections.includes(i.href)),
    [sections],
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface md:flex">
      <div className="px-5 py-5">
        <BrandLogo variant="wordmark" className="h-6 w-auto" subtitle={SUBTITLE} priority />
      </div>

      <nav aria-label="Asosiy navigatsiya" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: ItemIcon }) => {
            const active = isActive(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-tint text-brand-dark"
                      : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {active && (
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
        <div className="mb-2 flex items-center gap-2.5 px-2 py-1.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {ACADEMIC_HEAD.initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {ACADEMIC_HEAD.shortName}
            </span>
            <span className="block truncate text-xs text-foreground-muted">
              Oʻquv boʻlimi mudiri
            </span>
          </span>
        </div>
        <Link
          href="/login"
          onClick={() => logout()}
          className="focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-danger"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          Chiqish
        </Link>
      </div>
    </aside>
  );
}

export function AcademicMobileTopBar() {
  const pathname = usePathname();

  const { sections } = useAccess();
  const nav = useMemo(
    () => ACADEMIC_NAV.filter((i) => sections.includes(i.href)),
    [sections],
  );
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5 md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menyuni ochish"
        className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <BrandLogo variant="wordmark" className="h-5 w-auto" subtitle={SUBTITLE} />

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Menyuni yopish"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/20"
          />
          <aside className="animate-expand absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-lg">
            <div className="flex items-center justify-between px-5 py-5">
              <BrandLogo variant="wordmark" className="h-6 w-auto" subtitle={SUBTITLE} />
              <button
                type="button"
                aria-label="Yopish"
                onClick={() => setOpen(false)}
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-2">
              <ul className="flex flex-col gap-1">
                {nav.map(({ href, label, icon: ItemIcon }) => {
                  const active = isActive(href, pathname);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
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
                onClick={() => logout()}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted hover:bg-surface-muted hover:text-danger"
              >
                <LogoutIcon className="h-5 w-5 shrink-0" />
                Chiqish
              </Link>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
