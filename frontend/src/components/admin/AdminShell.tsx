"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { LogoutIcon, MenuIcon, UserIcon, XIcon } from "@/components/ui/icons";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { ADMIN_NAV, isNavActive } from "@/components/admin/nav";
import { useAdmin } from "@/lib/admin/store";
import { logout } from "@/lib/auth";

const SUBTITLE = "Administrator";

/** Chapdagi doimiy panel — faqat md dan yuqorida. */
export function AdminSidebar() {
  const pathname = usePathname();
  const { profile } = useAdmin();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface md:flex">
      <div className="px-5 py-5">
        <BrandLogo variant="wordmark" className="h-6 w-auto" subtitle={SUBTITLE} priority />
      </div>

      <nav aria-label="Asosiy navigatsiya" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {ADMIN_NAV.map(({ href, label, icon: ItemIcon }) => {
            const active = isNavActive(href, pathname);
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
        <Link
          href="/admin/profil"
          aria-current={pathname.startsWith("/admin/profil") ? "page" : undefined}
          className={`focus-ring mb-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
            pathname.startsWith("/admin/profil") ? "bg-brand-tint" : "hover:bg-surface-muted"
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {initials(profile.fullName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {profile.fullName}
            </span>
            <span className="block truncate text-xs text-foreground-muted">
              {profile.position}
            </span>
          </span>
        </Link>
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

/** Yuqoridagi qidiruv paneli — md dan yuqorida. */
export function AdminTopbar() {
  const { profile } = useAdmin();

  return (
    <header className="sticky top-0 z-20 hidden items-center gap-4 border-b border-border bg-surface/95 px-6 py-3 backdrop-blur md:flex">
      <AdminSearch className="w-full max-w-xs" />
      <div className="ml-auto flex items-center gap-3">
        <AdminNotifications />
        <Link
          href="/admin/profil"
          aria-label="Profil"
          title={profile.fullName}
          className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          {initials(profile.fullName)}
        </Link>
      </div>
    </header>
  );
}

/** Telefon uchun — hamburger + qidiruv. */
export function AdminMobileTopBar() {
  const pathname = usePathname();
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

      <AdminSearch className="min-w-0 flex-1" compact />

      <AdminNotifications />

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
                {ADMIN_NAV.map(({ href, label, icon: ItemIcon }) => {
                  const active = isNavActive(href, pathname);
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
                href="/admin/profil"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              >
                <UserIcon className="h-5 w-5 shrink-0" />
                Profil
              </Link>
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

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

