"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { NavBadge } from "@/components/shared/NavBadge";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useAccess } from "@/lib/access-api";
import { logout } from "@/lib/auth";
import type { Child } from "@/lib/parent/api";

/**
 * Ota-ona kabineti qobigʻi.
 *
 * MOBIL-BIRINCHI (CLAUDE.md, NFR-03): ota-ona telefonda, kuniga 1-2
 * daqiqa kiradi — "bolam bugun keldimi, bahosi qanday". Shuning uchun
 * telefonda pastda navigatsiya, katta ekranda chapda panel.
 *
 * Farzand almashtirgich (OTA-02) eng tepada — bir nechta farzandi
 * boʻlgan ota-ona uni birinchi qidiradi.
 */

/**
 * Telefonda pastki menyu — kundalik 5 ta amal.
 *
 * Eʼlonlar bu yerda YOʻQ: 360px da 6 ta band sigʻmaydi (har biriga 60px,
 * "Bosh sahifa" yozuvi kesilib ketadi). Eʼlonlarga sarlavhadagi
 * qoʻngʻiroq belgisi orqali kiriladi — oʻqilmagan xabar soni bilan.
 */
const NAV = [
  { href: "/ota-ona", label: "Bosh sahifa", icon: HomeIcon, exact: true },
  { href: "/ota-ona/davomat", label: "Davomat", icon: CalendarIcon },
  { href: "/ota-ona/baholar", label: "Baholar", icon: StarIcon },
  { href: "/ota-ona/tolov", label: "Toʻlov", icon: WalletIcon },
  { href: "/ota-ona/murojaat", label: "Murojaat", icon: ChatIcon },
] as const;

/** Katta ekranda joy yetarli — qolgan boʻlimlar ham roʻyxatda. */
const SIDEBAR_NAV = [
  ...NAV.slice(0, 3),
  // Uy vazifasi sidebarda alohida (egasining soʻrovi). Telefonda pastki
  // menyuga sigʻmaydi — u yerdan bosh sahifadagi «Topshirilmagan vazifa»
  // kartasi orqali kiriladi.
  { href: "/ota-ona/vazifalar", label: "Uy vazifasi", icon: BookIcon },
  ...NAV.slice(3),
  { href: "/ota-ona/tarbiya", label: "Tarbiya va psixologiya", icon: HeartIcon },
  { href: "/ota-ona/shartnoma", label: "Shartnoma", icon: FileIcon },
  { href: "/ota-ona/oshxona", label: "Oshxona menyusi", icon: MealIcon },
  { href: "/ota-ona/elonlar", label: "Eʼlonlar", icon: BellIcon },
  { href: "/ota-ona/sorovnoma", label: "Soʻrovnoma", icon: StarIcon },
] as const;

export function ParentShell({
  title,
  child,
  onChildChange,
  siblings,
  children,
}: {
  title: string;
  child: Child;
  onChildChange: (id: string) => void;
  /**
   * Farzandlar roʻyxati — almashtirgich uchun (OTA-02).
   *
   * Avval mockdagi `CHILDREN` dan olinardi. Endi propdan: roʻyxat
   * backenddan keladi va har vasiyda boshqacha.
   */
  siblings?: Child[];
  children: React.ReactNode;
}) {
  const royxat = siblings ?? [child];
  const pathname = usePathname();

  // Menyu serverdan kelgan boʻlimlar boʻyicha (T-005).
  const { sections } = useAccess();
  const nav = useMemo(() => NAV.filter((i) => sections.includes(i.href)), [sections]);
  const sidebarNav = useMemo(
    () => SIDEBAR_NAV.filter((i) => sections.includes(i.href)),
    [sections],
  );
  return (
    <div className="min-h-screen bg-background">
      {/* --- Katta ekran: chap panel --- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="px-5 py-5">
          <BrandLogo variant="wordmark" className="h-6 w-auto" subtitle="Ota-ona kabineti" priority />
        </div>

        <nav aria-label="Asosiy navigatsiya" className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-1">
            {sidebarNav.map(({ href, label, icon: Icon, ...rest }) => {
              const exact = "exact" in rest && rest.exact;
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      active
                        ? "bg-brand-tint text-brand-dark"
                        : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                    }`}
                  >
                    <Icon />
                    {label}
                    <NavBadge section={href} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/ota-ona/sozlamalar"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <GearIcon />
            Sozlamalar
          </Link>
          <button
            type="button"
            onClick={() => {
              void logout();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <LogoutIcon />
            Chiqish
          </button>
        </div>
      </aside>

      {/* --- Kontent --- */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <BrandLogo variant="wordmark" className="h-5 w-auto shrink-0 lg:hidden" priority />
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold lg:text-lg">
              {title}
            </h1>

            <NotificationBell className="shrink-0" />

            {/* Eʼlonlar — telefonda shu yerdan kiriladi (pastki menyuda joy yoʻq).
                Belgichasi karnay: yonida bildirishnoma qoʻngʻirogʻi turibdi va
                ikkita bir xil qoʻngʻiroq chalgʻitardi. */}
            <Link
              href="/ota-ona/elonlar"
              aria-label="Eʼlonlar"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
            >
              <MegaphoneIcon />
            </Link>
          </div>

          {/* OTA-02: farzand almashtirgich */}
          {royxat.length > 1 && (
            <div
              role="tablist"
              aria-label="Farzandni tanlash"
              className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-6"
            >
              {royxat.map((c) => {
                const active = c.id === child.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onChildChange(c.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      active
                        ? "border-brand bg-brand-tint text-brand-dark"
                        : "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                        active ? "bg-brand text-brand-foreground" : "bg-surface-muted"
                      }`}
                    >
                      {c.shortName.charAt(0)}
                    </span>
                    {c.shortName}
                    <span className="text-xs opacity-70">{c.className}</span>
                    {c.isArchived && (
                      <span className="rounded-full bg-surface-muted px-1.5 text-[10px] font-semibold uppercase text-foreground-muted">
                        ketgan
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <main className="px-4 py-5 pb-24 sm:px-6 lg:pb-6">{children}</main>
      </div>

      {/* --- Telefon: pastdagi navigatsiya --- */}
      <nav
        aria-label="Asosiy navigatsiya"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex">
          {nav.map(({ href, label, icon: Icon, ...rest }) => {
            const exact = "exact" in rest && rest.exact;
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href} className="min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${
                    active ? "text-brand-dark" : "text-foreground-muted"
                  }`}
                >
                  <Icon />
                  <span className="truncate">{label}</span>
                  <NavBadge section={href} floating />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/* --- Ikonkalar (tashqi kutubxonasiz) --- */

function HomeIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16.5M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-4.5H6.5A2.5 2.5 0 0 0 4 19.5Z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
      <circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/** Eʼlonlar — maktab hammaga aytadigan xabar. Shaxsiy bildirishnoma
    qoʻngʻirogʻidan ataylab boshqa belgicha. */
function MegaphoneIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 15-6v14L3 13Z" />
      <path d="M3 11v2a2 2 0 0 0 2 2h1v4h3v-4" />
      <path d="M21 10v4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.6c0 5-7 9.4-7 9.4Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function MealIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v7a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V3M5 3v18" />
      <path d="M17 3c-1.7 0-3 2-3 5.5S15.3 13 17 13v8" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-1.6-1H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3 8.6a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8.6 3 1.7 1.7 0 0 0 10 1.4V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15.4 3a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 22.6 9H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17l5-5-5-5M20 12H9M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
