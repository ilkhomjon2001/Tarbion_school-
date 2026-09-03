"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { fetchAnnouncements, type AnnouncementOut } from "@/lib/announcements/api";
import { formatSom, todayIso } from "@/lib/format";
import {
  fetchAttendance,
  fetchAttendanceStats,
  monthRange,
  type AttendanceStatOut,
  type DayAttendance,
} from "@/lib/parent/api";
import { useChildren } from "@/lib/parent/useChild";
import { fetchLedger } from "@/lib/payments/api";
import { fetchHomeworkList, fetchSubjectGrades } from "@/lib/student/api";
import type { GradeEntry } from "@/lib/types";

/**
 * Ota-ona bosh sahifasi (OTA-01) — BAZADAN.
 *
 * Bitta savolga javob beradi: "bolam bugun qanday?" Shuning uchun eng
 * tepada bugungi davomat, keyin soʻnggi baholar, toʻlov holati va
 * eʼlonlar. Ota-ona kuniga bir-ikki daqiqa kiradi — hammasi bitta
 * ekranda koʻrinishi kerak.
 *
 * Avval toʻlov/vazifa/baho kartalari mock edi va qarzdor ota-onaga
 * "Toʻlangan" koʻrsatardi (audit K2). Endi hammasi real API'dan:
 * toʻlov — `fetchLedger`, vazifa — `fetchHomeworkList`, baho —
 * `fetchSubjectGrades`, davomat foizi — `GET /attendance/stats`
 * (backend formulasi — yagona haqiqat, Y10).
 */

const OYLAR = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

/** Blok holati: null — yuklanmoqda, "error" — olib boʻlmadi. */
type Loadable<T> = T | null | "error";

export default function ParentHomePage() {
  const { child, children: farzandlar, select, loading, error } = useChildren();

  const bugun = todayIso();
  const [days, setDays] = useState<Loadable<DayAttendance[]>>(null);
  const [stat, setStat] = useState<Loadable<AttendanceStatOut>>(null);
  const [pendingHw, setPendingHw] = useState<Loadable<number>>(null);
  const [balance, setBalance] = useState<Loadable<number>>(null);
  const [grades, setGrades] = useState<Loadable<GradeEntry[]>>(null);
  const [news, setNews] = useState<Loadable<AnnouncementOut[]>>(null);

  // Eʼlonlar farzandga bogʻliq emas — server vasiyning barcha
  // farzandlari sinflari boʻyicha kesib beradi.
  useEffect(() => {
    let alive = true;
    fetchAnnouncements()
      .then((rows) => alive && setNews(rows))
      .catch(() => alive && setNews("error"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!child) return;
    let alive = true;
    const [y, m] = bugun.split("-").map(Number);
    const range = monthRange(y, m);

    setDays(null);
    setStat(null);
    setPendingHw(null);
    setBalance(null);
    setGrades(null);

    fetchAttendance(child.id, range)
      .then((rows) => alive && setDays(rows))
      .catch(() => alive && setDays("error"));

    fetchAttendanceStats(child.id, range)
      .then((s) => alive && setStat(s))
      .catch(() => alive && setStat("error"));

    fetchHomeworkList(child.id)
      .then((rows) => {
        if (!alive) return;
        setPendingHw(
          rows.filter(
            (h) =>
              h.status === "assigned" ||
              h.status === "late" ||
              h.status === "returned",
          ).length,
        );
      })
      .catch(() => alive && setPendingHw("error"));

    fetchLedger(child.id)
      .then((l) => alive && setBalance(l.finance.balance))
      .catch(() => alive && setBalance("error"));

    fetchSubjectGrades(child.id)
      .then((subjects) => {
        if (!alive) return;
        setGrades(
          subjects
            .flatMap((s) => s.entries)
            .filter((g) => g.date)
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 5),
        );
      })
      .catch(() => alive && setGrades("error"));

    return () => {
      alive = false;
    };
  }, [child, bugun]);

  const today = useMemo(
    () =>
      (Array.isArray(days) ? days : []).find((d) => d.date === bugun) ?? null,
    [days, bugun],
  );

  // O19: yuklanish paytida boʻsh ekran emas — skelet.
  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-5 sm:px-6" aria-busy="true">
        <div className="mb-5 h-7 w-48 animate-pulse rounded-lg bg-surface-muted" />
        <div className="mb-5 h-24 animate-pulse rounded-xl bg-surface-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-muted" />
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="font-medium">{error ?? "Sizga farzand biriktirilmagan"}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Maktab administratoriga murojaat qiling.
          </p>
        </div>
      </div>
    );
  }

  // Qarz — manfiy balans (backend qoidasi, /ota-ona/tolov bilan bir xil).
  const qarz =
    typeof balance === "number" && balance < 0 ? -balance : 0;
  const missed = today?.lessons.filter((l) => l.status !== "present") ?? [];

  return (
    <ParentShell
      title={`Salom! ${child.shortName}`}
      child={child}
      siblings={farzandlar}
      onChildChange={select}
    >
      {/* --- Bugungi holat --- */}
      <section className="mb-5">
        <h2 className="mb-2.5 text-sm font-semibold">
          Bugun · {Number(bugun.slice(8))}-{OYLAR[Number(bugun.slice(5, 7)) - 1]}
        </h2>

        {days === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />
        ) : days === "error" ? (
          <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-sm text-danger">
            Bugungi davomatni yuklab boʻlmadi. Sahifani yangilab koʻring.
          </p>
        ) : !today ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
            <p className="font-medium">Bugun davomat hali belgilanmagan</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Dam olish kuni yoki darslar hali boshlanmagan.
            </p>
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
              {today.lessons.length} darsdan{" "}
              {today.lessons.length - missed.length} tasida qatnashdi
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
          loading={stat === null}
          value={stat === "error" || stat === null ? "—" : `${Math.round(stat.percent)}%`}
          hint={
            stat === "error"
              ? "Yuklab boʻlmadi"
              : stat === null
                ? ""
                : `${stat.absent} sababsiz · ${stat.excused} sababli`
          }
          tone={
            typeof stat === "object" && stat !== null
              ? stat.percent >= 90
                ? "text-success"
                : "text-warning"
              : "text-foreground-muted"
          }
        />
        <Tile
          href="/ota-ona/baholar"
          label="Topshirilmagan vazifa"
          loading={pendingHw === null}
          value={pendingHw === "error" || pendingHw === null ? "—" : pendingHw}
          hint={
            pendingHw === "error"
              ? "Yuklab boʻlmadi"
              : pendingHw === null
                ? ""
                : pendingHw > 0
                  ? "Muddati oʻtmasidan topshirsin"
                  : "Hammasi topshirilgan"
          }
          tone={
            typeof pendingHw === "number"
              ? pendingHw > 0
                ? "text-warning"
                : "text-success"
              : "text-foreground-muted"
          }
        />
        <Tile
          href="/ota-ona/tolov"
          label="Toʻlov holati"
          loading={balance === null}
          value={
            balance === "error" || balance === null
              ? "—"
              : qarz > 0
                ? "Qarzdorlik"
                : "Toʻlangan"
          }
          hint={
            balance === "error"
              ? "Yuklab boʻlmadi"
              : balance === null
                ? ""
                : qarz > 0
                  ? `Qarz: ${formatSom(qarz)}`
                  : "Qarzdorlik yoʻq"
          }
          tone={
            typeof balance === "number"
              ? qarz > 0
                ? "text-danger"
                : "text-success"
              : "text-foreground-muted"
          }
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

          {grades === null ? (
            <div className="h-48 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />
          ) : grades === "error" ? (
            <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-sm text-danger">
              Baholarni yuklab boʻlmadi.
            </p>
          ) : grades.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-foreground-muted">
              Hozircha baho qoʻyilmagan.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {grades.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-4 py-3">
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
          )}
        </section>

        {/* --- Eʼlonlar va tadbirlar (OTA-08) --- */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Eʼlonlar</h2>
            <Link
              href="/ota-ona/elonlar"
              className="text-sm text-brand-dark underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Barchasi
            </Link>
          </div>

          {news === null ? (
            <div className="h-48 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />
          ) : news === "error" ? (
            <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-sm text-danger">
              Eʼlonlarni yuklab boʻlmadi.
            </p>
          ) : news.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-foreground-muted">
              Hozircha eʼlon yoʻq.
            </p>
          ) : (
            <ul className="space-y-3">
              {news.slice(0, 3).map((a) => (
                <li
                  key={a.id}
                  className={`rounded-xl border bg-surface p-4 ${
                    a.important ? "border-warning/40" : "border-border"
                  }`}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
                      {a.class_names.length > 0
                        ? a.class_names.join(", ")
                        : "Butun maktab"}
                    </span>
                    {a.important && (
                      <span className="rounded-full bg-warning-tint px-2.5 py-0.5 text-xs font-medium text-warning">
                        Muhim
                      </span>
                    )}
                  </div>
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground-muted">{a.body}</p>
                  <p className="mt-2 text-xs text-foreground-muted">
                    {a.author_name} ·{" "}
                    {new Date(a.created_at).toLocaleDateString("uz-UZ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
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
  loading,
}: {
  href: string;
  label: string;
  value: string | number;
  hint: string;
  tone: string;
  loading?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-surface-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <p className="text-xs uppercase tracking-wide text-foreground-muted">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-surface-muted" aria-busy="true" />
      ) : (
        <p className={`mt-1 text-2xl font-semibold num ${tone}`}>{value}</p>
      )}
      <p className="mt-0.5 truncate text-xs text-foreground-muted">{hint}</p>
    </Link>
  );
}
