"use client";

import { useEffect, useMemo, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { createAppeal } from "@/lib/appeals/api";
import {
  dayStatus,
  fetchAttendance,
  fetchAttendanceStats,
  monthRange,
  type AttendanceStatOut,
  type AttendanceStatus,
  type DayAttendance,
} from "@/lib/parent/api";
import { useChildren } from "@/lib/parent/useChild";

/**
 * Davomat kalendari (OTA-03) va sababli qoldirish arizasi (DAV-04).
 *
 * Sababli va sababsiz qoldirish rangi bilan ajratilgan, lekin rang
 * yolgʻiz maʼno tashimaydi — har katakchada belgi ham bor.
 */

const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const OYLAR = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

/** Bugungi sana — Asia/Tashkent boʻyicha (CLAUDE.md 3-qoida). */
function bugungiSana(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

const CELL: Record<AttendanceStatus, { box: string; mark: string; label: string }> = {
  present: { box: "bg-success-tint text-success", mark: "✓", label: "Qatnashdi" },
  absent: { box: "bg-danger text-brand-foreground", mark: "✕", label: "Sababsiz" },
  excused: { box: "bg-info-tint text-info", mark: "S", label: "Sababli" },
  late: { box: "bg-warning-tint text-warning", mark: "K", label: "Kechikdi" },
};

export default function ParentAttendancePage() {
  const { child, children: farzandlar, select, loading, error: childError } = useChildren();
  const [openDay, setOpenDay] = useState<DayAttendance | null>(null);
  const [showForm, setShowForm] = useState(false);

  const bugun = bugungiSana();
  // Koʻrsatilayotgan oy. Sukut — joriy oy; avval 2026-avgust qattiq
  // yozilgandi va sentabrga oʻtganda sahifa eskirib qolardi.
  const [ym, setYm] = useState(() => ({
    year: Number(bugun.slice(0, 4)),
    month: Number(bugun.slice(5, 7)),
  }));

  const [days, setDays] = useState<DayAttendance[] | null>(null);
  // Oylik xulosa BACKENDDAN (`GET /attendance/stats`) — foiz clientda
  // qayta hisoblanmaydi, hamma kabinet bitta formulani koʻradi (Y10).
  const [summary, setSummary] = useState<AttendanceStatOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!child) return;
    let alive = true;

    setDays(null);
    setSummary(null);
    setError(null);
    const range = monthRange(ym.year, ym.month);
    Promise.all([
      fetchAttendance(child.id, range),
      fetchAttendanceStats(child.id, range),
    ])
      .then(([rows, stat]) => {
        if (!alive) return;
        setDays(rows);
        setSummary(stat);
      })
      .catch(() => alive && setError("Davomatni yuklab boʻlmadi."));

    return () => {
      alive = false;
    };
  }, [child, ym.year, ym.month]);
  const byDate = useMemo(() => new Map((days ?? []).map((d) => [d.date, d])), [days]);
  const percent = summary ? Math.round(summary.percent) : 0;

  /** Oy katakchalari — dushanbadan boshlanadi. */
  const cells = useMemo(() => {
    const first = new Date(ym.year, ym.month - 1, 1);
    const lead = (first.getDay() + 6) % 7; // dushanba = 0
    const last = new Date(ym.year, ym.month, 0).getDate();
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: last }, (_, i) => i + 1),
    ];
  }, [ym.year, ym.month]);

  function siljit(delta: number) {
    setYm((p) => {
      const m = p.month + delta;
      if (m < 1) return { year: p.year - 1, month: 12 };
      if (m > 12) return { year: p.year + 1, month: 1 };
      return { year: p.year, month: m };
    });
  }

  if (loading) return null;

  if (!child) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="font-medium">
            {childError ?? "Sizga farzand biriktirilmagan"}
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            Maktab administratoriga murojaat qiling.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ParentShell
      title="Davomat"
      child={child}
      siblings={farzandlar}
      onChildChange={select}
    >
      {/* Oylik xulosa */}
      <div className="mb-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <MonthButton label="Oldingi oy" onClick={() => siljit(-1)}>
              ‹
            </MonthButton>
            <p className="min-w-[9.5rem] text-center font-semibold">
              {OYLAR[ym.month - 1]} {ym.year}
            </p>
            <MonthButton label="Keyingi oy" onClick={() => siljit(1)}>
              ›
            </MonthButton>
          </div>
          {summary === null ? (
            <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" aria-busy="true" />
          ) : (
            <p
              className={`text-2xl font-bold num ${percent >= 90 ? "text-success" : "text-warning"}`}
            >
              {percent}%
            </p>
          )}
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Oylik qatnashish foizi"
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className={`h-full rounded-full ${percent >= 90 ? "bg-success" : "bg-warning"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Qatnashdi" value={summary?.present ?? 0} tone="text-success" />
          <Stat label="Sababsiz" value={summary?.absent ?? 0} tone="text-danger" />
          <Stat label="Sababli" value={summary?.excused ?? 0} tone="text-info" />
          <Stat label="Kechikdi" value={summary?.late ?? 0} tone="text-warning" />
        </dl>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {/* Kalendar */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted/60">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="px-1 py-2 text-center text-xs font-medium uppercase tracking-wide text-foreground-muted"
            >
              {w}
            </div>
          ))}
        </div>

        {days === null && !error ? (
          <div className="grid grid-cols-7 gap-1 p-2" aria-busy="true" aria-label="Yuklanmoqda">
            {Array.from({ length: 35 }, (_, i) => (
              <span key={i} className="aspect-square animate-pulse rounded-lg bg-surface-muted" />
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-7 gap-1 p-2">
          {cells.map((d, i) => {
            if (d === null) return <span key={`x-${i}`} />;
            const date = `${ym.year}-${String(ym.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const day = byDate.get(date);
            const isToday = date === bugun;

            if (!day) {
              return (
                <span
                  key={date}
                  className="flex aspect-square items-center justify-center rounded-lg text-sm text-foreground-muted/40"
                >
                  {d}
                </span>
              );
            }

            const st = dayStatus(day);
            const cell = CELL[st];
            return (
              <button
                key={date}
                type="button"
                onClick={() => setOpenDay(day)}
                aria-label={`${d}-${OYLAR[ym.month - 1].toLowerCase()}: ${cell.label}`}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-medium transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${cell.box} ${
                  isToday ? "ring-2 ring-brand ring-offset-1" : ""
                }`}
              >
                <span>{d}</span>
                <span aria-hidden className="text-[10px] leading-none opacity-80">
                  {cell.mark}
                </span>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* Izoh — rang yolgʻiz maʼno tashimasin */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground-muted">
        <span className="font-medium">Izoh:</span>
        {(Object.keys(CELL) as AttendanceStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${CELL[k].box}`}
            >
              {CELL[k].mark}
            </span>
            {CELL[k].label}
          </span>
        ))}
      </div>

      {/* DAV-04: sababli qoldirish arizasi */}
      <section className="mt-5">
        {showForm ? (
          <ExcuseForm studentId={child.id} onClose={() => setShowForm(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Sababli qoldirish arizasini yuborish
          </button>
        )}
      </section>

      {openDay && <DaySheet day={openDay} onClose={() => setOpenDay(null)} />}
    </ParentShell>
  );
}

/* --- Kun tafsiloti --- */

function DaySheet({ day, onClose }: { day: DayAttendance; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/25"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${day.date} kuni davomati`}
        className="relative w-full max-w-md rounded-t-2xl border border-border bg-surface p-4 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">{day.date}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            ✕
          </button>
        </div>

        <ul className="mt-3 divide-y divide-border">
          {day.lessons.map((l) => (
            <li key={l.period} className="flex items-center gap-3 py-2.5">
              <span className="w-14 shrink-0 text-sm text-foreground-muted">
                {l.period}-para
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{l.subject}</span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${CELL[l.status].box}`}
              >
                {CELL[l.status].label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* --- DAV-04: ariza --- */

function ExcuseForm({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState(false);
  const [dan, setDan] = useState(bugungiSana());
  const [gacha, setGacha] = useState(bugungiSana());
  const [sabab, setSabab] = useState("");

  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-success/30 bg-success-tint p-4">
        <p className="font-medium text-success">Ariza yuborildi</p>
        <p className="mt-1 text-sm text-success/85">
          Sinf rahbariga murojaat sifatida yetkazildi — javobni «Murojaat»
          boʻlimida koʻrasiz.
        </p>
      </div>
    );
  }

  async function yubor(e: React.FormEvent) {
    e.preventDefault();
    if (busy || sabab.trim().length < 3) return;
    setBusy(true);
    setXato(false);
    try {
      // DAV-04 arizasi — sinf rahbariga MUROJAAT sifatida boradi:
      // alohida jadval kerak emas, javob yozishmasi ham tayyor (MUR-*).
      await createAppeal({
        studentId,
        target: "homeroom",
        title: `Sababli qoldirish arizasi (${dan} — ${gacha})`,
        body: `Davr: ${dan} — ${gacha}.\nSabab: ${sabab.trim()}`,
      });
      setSent(true);
      setTimeout(onClose, 2500);
    } catch {
      setXato(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={yubor} className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Sababli qoldirish arizasi</h2>

      {xato && (
        <p className="mt-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Yuborib boʻlmadi. Internetni tekshirib, qayta urinib koʻring.
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ex-from" className="mb-1.5 block text-sm font-medium">
            Boshlanish sanasi
          </label>
          <input
            id="ex-from"
            type="date"
            required
            value={dan}
            onChange={(e) => setDan(e.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
        <div>
          <label htmlFor="ex-to" className="mb-1.5 block text-sm font-medium">
            Tugash sanasi
          </label>
          <input
            id="ex-to"
            type="date"
            required
            value={gacha}
            onChange={(e) => setGacha(e.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="ex-reason" className="mb-1.5 block text-sm font-medium">
            Sababi
          </label>
          <textarea
            id="ex-reason"
            rows={3}
            required
            value={sabab}
            onChange={(e) => setSabab(e.target.value.slice(0, 400))}
            placeholder="Masalan: shifokor koʻrigida edi"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-foreground-muted/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
          <p className="mt-1 text-xs text-foreground-muted">
            Shifokor maʼlumotnomasi boʻlsa, uni sinf rahbariga koʻrsatasiz —
            fayl yuklash tez orada qoʻshiladi.
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={busy || sabab.trim().length < 3}
          className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {busy ? "Yuborilmoqda…" : "Arizani yuborish"}
        </button>
      </div>
    </form>
  );
}


function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-surface-muted/50 px-3 py-2">
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className={`text-lg font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}


function MonthButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-lg text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
