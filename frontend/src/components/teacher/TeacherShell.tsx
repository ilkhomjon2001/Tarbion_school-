"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { DEMO_LESSONS, DEMO_TEACHER } from "@/lib/teacher/data";
import { classColor } from "@/lib/teacher/schedule";

const TODAY_LESSONS = DEMO_LESSONS;

/**
 * Ustoz paneli qobigʻi — Stitch dizayni boʻyicha: chapda 260px doimiy
 * sidebar, yuqorida 64px topbar.
 *
 * Kichik ekranda sidebar yashiriladi va tugma bilan ochiladi (NFR-03:
 * 360px dan boshlab gorizontal siljish boʻlmasligi kerak).
 */

const NAV = [
  { href: "/teacher", label: "Bugungi darslar", icon: HomeIcon, exact: true },
  { href: "/teacher/jadval", label: "Dars jadvali", icon: CalendarIcon },
  { href: "/teacher/vazifa", label: "Uy vazifasi", icon: ClipboardIcon },
] as const;

export function TeacherShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* --- Sidebar --- */}
      <aside
        aria-label="Asosiy navigatsiya"
        className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-border bg-surface transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="px-6 py-5">
            <p className="text-xl font-bold tracking-tight text-brand">Tarbion</p>
            <p className="mt-0.5 text-xs text-foreground-muted">Taʼlim platformasi</p>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-2">
            <ul className="space-y-1">
              {NAV.map(({ href, label, icon: Icon, ...rest }) => {
                const exact = "exact" in rest && rest.exact;
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                        active
                          ? "bg-brand-tint text-brand-dark"
                          : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-5 w-0.5 rounded-full ${active ? "bg-brand" : "bg-transparent"}`}
                      />
                      <Icon />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Bugungi jadval — sidebardagi tez koʻrinish */}
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex items-center justify-between px-3">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  Bugungi jadval
                </p>
                <Link
                  href="/teacher/jadval"
                  onClick={() => setOpen(false)}
                  className="text-xs text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Barchasi
                </Link>
              </div>

              <ul className="space-y-1 px-1">
                {TODAY_LESSONS.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/teacher/davomat/${lesson.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <span
                        aria-hidden
                        className={`h-8 w-1 shrink-0 rounded-full ${classColor(lesson.className).dot}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {lesson.className} · {lesson.subject}
                        </span>
                        <span className="block truncate text-[11px] text-foreground-muted">
                          {lesson.startTime} · {lesson.room}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-dark">
                {DEMO_TEACHER.fullName.charAt(0)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {DEMO_TEACHER.shortName}
                </span>
                <span className="block text-xs text-foreground-muted">Ustoz</span>
              </span>
            </div>
            <Link
              href="/login"
              className="mt-1 flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <LogoutIcon />
              Chiqish
            </Link>
          </div>
        </div>
      </aside>

      {/* Kichik ekranda sidebar ochilganda orqa fon */}
      {open && (
        <button
          type="button"
          aria-label="Menyuni yopish"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
        />
      )}

      {/* --- Kontent --- */}
      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menyuni ochish"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
          >
            <MenuIcon />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-foreground-muted sm:text-sm">{subtitle}</p>
            )}
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}

/* --- Ikonkalar (tashqi kutubxonasiz — bundle yengil qolsin) --- */

function HomeIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
