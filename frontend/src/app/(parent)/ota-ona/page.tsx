"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import {
  attendanceForMonth,
  formatSom,
  HOMEWORK,
  monthSummary,
  PAYMENTS,
  RECENT_GRADES,
  TODAY,
  TODAY_LABEL,
} from "@/lib/parent/data";
import {
  newsForClass,
  NEWS_KIND_LABELS,
  NEWS_KIND_TONE,
} from "@/lib/parent/news";
import { useChild } from "@/lib/parent/useChild";

/**
 * Ota-ona bosh sahifasi (OTA-01).
 *
 * Bitta savolga javob beradi: "bolam bugun qanday?" Shuning uchun eng
 * tepada bugungi davomat, keyin soʻnggi baholar, toʻlov holati va
 * eʼlonlar. Ota-ona kuniga bir-ikki daqiqa kiradi — hammasi bitta
 * ekranda koʻrinishi kerak.
 */
export default function ParentHomePage() {
  const [child, setChild] = useChild();

  const today = useMemo(() => {
    const days = attendanceForMonth(child.id, 2026, 8);
    return days.find((d) => d.date === TODAY) ?? null;
  }, [child.id]);

  const month = useMemo(
    () => monthSummary(attendanceForMonth(child.id, 2026, 8)),
    [child.id],
  );

  const grades = RECENT_GRADES[child.id] ?? [];
  const news = useMemo(() => newsForClass(child.className), [child.className]);
  const payment = PAYMENTS[child.id];
  const pendingHw = (HOMEWORK[child.id] ?? []).filter(
    (h) => h.status === "assigned" || h.status === "late",
  );

  const missed = today?.lessons.filter((l) => l.status !== "present") ?? [];

  return (
    <ParentShell title={`Salom! ${child.shortName}`} child={child} onChildChange={setChild}>
      {/* --- Bugungi holat --- */}
      <section className="mb-5">
        <h2 className="mb-2.5 text-sm font-semibold">Bugun · {TODAY_LABEL}</h2>

        {!today ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
            <p className="font-medium">Bugun dars yoʻq</p>
            <p className="mt-1 text-sm text-foreground-muted">Dam olish kuni.</p>
          </div>
        ) : missed.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-tint p-4">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-brand-foreground"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l6 6L20 6" />
              </svg>
            </span>
            <div>
              <p className="font-semibold text-success">
                {today.lessons.length} darsdan {today.lessons.length} tasida qatnashdi
              </p>
              <p className="text-sm text-success/80">Bugun hammasi joyida.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-warning/40 bg-warning-tint p-4">
            <p className="font-semibold text-warning">
              {today.lessons.length - missed.length} darsdan{" "}
              {today.lessons.length} tasida qatnashdi
            </p>
            <ul className="mt-2 space-y-1">
              {missed.map((l) => (
                <li key={l.period} className="text-sm text-warning">
                  {l.period}-para · {l.subject} —{" "}
                  {l.status === "absent"
                    ? "sababsiz qoldirdi"
                    : l.status === "excused"
                      ? "sababli"
                      : "kechikdi"}
                </li>
              ))}
            </ul>
            <Link
              href="/ota-ona/davomat"
              className="mt-3 inline-flex h-9 items-center rounded-lg bg-warning px-3 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Sabab bildirish
            </Link>
          </div>
        )}
      </section>

      {/* --- Qisqa koʻrsatkichlar --- */}
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <Tile
          href="/ota-ona/davomat"
          label="Oylik davomat"
          value={`${month.percent}%`}
          hint={`${month.absent} sababsiz · ${month.excused} sababli`}
          tone={month.percent >= 90 ? "text-success" : "text-warning"}
        />
        <Tile
          href="/ota-ona/baholar"
          label="Topshirilmagan vazifa"
          value={pendingHw.length}
          hint={pendingHw.length ? pendingHw[0].subject : "Hammasi topshirilgan"}
          tone={pendingHw.length ? "text-warning" : "text-success"}
        />
        <Tile
          href="/ota-ona/tolov"
          label="Toʻlov holati"
          value={payment.balance > 0 ? "Qarzdorlik" : "Toʻlangan"}
          hint={payment.balance > 0 ? formatSom(payment.balance) : `Keyingi: ${payment.nextDueDate}`}
          tone={payment.balance > 0 ? "text-danger" : "text-success"}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* --- Soʻnggi baholar --- */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Soʻnggi baholar</h2>
            <Link
              href="/ota-ona/baholar"
              className="text-sm text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Barchasi
            </Link>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {grades.slice(0, 5).map((g, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    g.value >= 4
                      ? "bg-success-tint text-success"
                      : g.value === 3
                        ? "bg-warning-tint text-warning"
                        : "bg-danger-tint text-danger"
                  }`}
                >
                  {g.value}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.subject}</span>
                  <span className="block text-xs text-foreground-muted">
                    {g.date}
                    {g.kind === "control" && " · nazorat ishi"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Eʼlonlar va tadbirlar (OTA-08) --- */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Eʼlonlar va tadbirlar</h2>
            <Link
              href="/ota-ona/elonlar"
              className="text-sm text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Barchasi
            </Link>
          </div>

          <ul className="space-y-3">
            {news.slice(0, 3).map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border bg-surface p-4 ${
                  a.important ? "border-warning/40" : "border-border"
                }`}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${NEWS_KIND_TONE[a.kind]}`}
                  >
                    {NEWS_KIND_LABELS[a.kind]}
                  </span>
                  {a.important && (
                    <span className="rounded-full bg-warning-tint px-2.5 py-0.5 text-xs font-medium text-warning">
                      Muhim
                    </span>
                  )}
                </div>
                <p className="font-medium">{a.title}</p>
                {a.eventDate && (
                  <p className="mt-1 text-sm text-info">
                    {a.eventDate}
                    {a.eventTime && `, ${a.eventTime}`}
                    {a.place && ` · ${a.place}`}
                  </p>
                )}
                <p className="mt-1 line-clamp-2 text-sm text-foreground-muted">{a.body}</p>
                <p className="mt-2 text-xs text-foreground-muted">
                  {a.from} · {a.createdAt}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ParentShell>
  );
}

function Tile({
  href,
  label,
  value,
  hint,
  tone,
}: {
  href: string;
  label: string;
  value: string | number;
  hint: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-surface-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <p className="text-xs uppercase tracking-wide text-foreground-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold num ${tone}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-foreground-muted">{hint}</p>
    </Link>
  );
}
