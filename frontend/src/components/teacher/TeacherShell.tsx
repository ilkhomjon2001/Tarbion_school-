"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccess } from "@/lib/access-api";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useEffect, useMemo, useState } from "react";

import { getTodayLessons } from "@/lib/teacher/attendance-api";
import { useTeacherMe } from "@/lib/teacher/me";
import { classColor } from "@/lib/teacher/schedule";
import type { TeacherLesson } from "@/lib/teacher/types";
import { logout } from "@/lib/auth";

/**
 * Ustoz paneli qobigʻi — Stitch dizayni boʻyicha: chapda 260px doimiy
 * sidebar, yuqorida 64px topbar.
 *
 * Kichik ekranda sidebar yashiriladi va tugma bilan ochiladi (NFR-03:
 * 360px dan boshlab gorizontal siljish boʻlmasligi kerak).
 */

/**
 * Menyu ikki guruhga boʻlingan: kundalik ish va sinf/fan boshqaruvi.
 *
 * Tekis roʻyxatda 6 ta band ustozni chalkashtiradi — nima kundalik, nima
 * vaqti-vaqti bilan kerakligi bilinmaydi. Guruh sarlavhasi shuni ajratadi.
 */
const NAV_GROUPS = [
  {
    title: "Kundalik",
    items: [
      { href: "/teacher", label: "Bugungi darslar", icon: HomeIcon, exact: true },
      { href: "/teacher/jadval", label: "Dars jadvali", icon: CalendarIcon },
      { href: "/teacher/vazifa", label: "Uy vazifasi", icon: ClipboardIcon },
    ],
  },
  {
    title: "Sinf va fan",
    items: [
      { href: "/teacher/jurnal", label: "Jurnal", icon: JournalIcon },
      { href: "/teacher/test", label: "Testlar", icon: TestIcon },
      { href: "/teacher/elon", label: "Eʼlonlar", icon: MegaphoneIcon },
    ],
  },
  {
    title: "Ota-onalar bilan",
    items: [
      { href: "/teacher/murojaat", label: "Murojaatlar", icon: ChatIcon },
      { href: "/teacher/tarbiya", label: "Tarbiyaviy izoh", icon: HeartIcon },
    ],
  },
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

  // Menyu SERVERDAN kelgan boʻlimlar boʻyicha filtrlanadi (T-005).
  // Super administrator ustozdan boʻlimni olib qoʻysa, u shu yerda
  // yoʻqoladi. Bu HIMOYA EMAS — soʻrovni server baribir tekshiradi.
  const { sections } = useAccess();
  const me = useTeacherMe();

  // Sidebardagi «Bugungi jadval» — serverdan, mock emas.
  const [today, setToday] = useState<TeacherLesson[]>([]);
  useEffect(() => {
    let alive = true;
    getTodayLessons()
      .then((rows) => alive && setToday(rows))
      .catch(() => alive && setToday([]));
    return () => {
      alive = false;
    };
  }, []);
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => sections.includes(i.href)),
      })).filter((g) => g.items.length > 0),
    [sections],
  );
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
            <BrandLogo variant="wordmark" className="h-6 w-auto" subtitle="Ustoz kabineti" priority />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-2">
            {groups.map((group) => (
              <div key={group.title} className="mb-4 last:mb-0">
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted/70">
                  {group.title}
                </p>
                <ul className="space-y-1">
                  {group.items.map(({ href, label, icon: Icon, ...rest }) => {
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
              </div>
            ))}

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
                {today.map((lesson) => (
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
                {today.length === 0 && (
                  <li className="px-3 py-1.5 text-[11px] text-foreground-muted">
                    Bugun dars yoʻq
                  </li>
                )}
              </ul>
            </div>
          </nav>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-dark">
                {me.fullName.charAt(0) || "?"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {me.shortName || "…"}
                </span>
                <span className="block text-xs text-foreground-muted">
                  {me.isHomeroom ? "Sinf rahbari" : "Ustoz"}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-1 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <LogoutIcon />
              Chiqish
            </button>
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


function TestIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
      <path d="M8.5 12l2 2 4-4" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M14 8.5a4 4 0 0 1 0 7M17 6a7 7 0 0 1 0 12" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v11H8.5L4 19.5V5Z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.6c0 5-7 9.4-7 9.4Z" />
    </svg>
  );
}

function JournalIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18M11 8h6M11 12h6M11 16h4" />
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
