"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatSom } from "@/lib/format";
import { useAdmin } from "@/lib/admin/store";
import { CLASSES } from "@/lib/director/school-data";
import { allTeachers, homeroomTeacherOf, subjectTeachersOf } from "@/lib/school/staff";
import { PERIOD_TIMES, WEEKDAYS } from "@/lib/director/types";

type Tab = "classes" | "subjects" | "rooms" | "calendar";

const TABS: { id: Tab; label: string }[] = [
  { id: "classes", label: "Sinflar" },
  { id: "subjects", label: "Fanlar" },
  { id: "rooms", label: "Xonalar" },
  { id: "calendar", label: "Oʻquv yili" },
];

const ROOMS = [
  { number: "101", kind: "Oddiy sinf xonasi", capacity: 30, floor: 1 },
  { number: "108", kind: "Ona tili kabineti", capacity: 28, floor: 1 },
  { number: "110", kind: "Tarix kabineti", capacity: 28, floor: 1 },
  { number: "204", kind: "Matematika kabineti", capacity: 30, floor: 2 },
  { number: "206", kind: "Ingliz tili kabineti", capacity: 24, floor: 2 },
  { number: "301", kind: "Fizika laboratoriyasi", capacity: 24, floor: 3 },
  { number: "302", kind: "Kimyo laboratoriyasi", capacity: 24, floor: 3 },
  { number: "305", kind: "Informatika xonasi", capacity: 20, floor: 3 },
  { number: "Sport", kind: "Sport zali", capacity: 60, floor: 1 },
];

const QUARTERS = [
  { name: "1-chorak", from: "2026-09-01", to: "2026-10-30", weeks: 9, status: "Joriy" },
  { name: "2-chorak", from: "2026-11-09", to: "2026-12-29", weeks: 7, status: "Rejada" },
  { name: "3-chorak", from: "2027-01-12", to: "2027-03-20", weeks: 10, status: "Rejada" },
  { name: "4-chorak", from: "2027-03-30", to: "2027-05-25", weeks: 8, status: "Rejada" },
];

/**
 * Maʼlumot bazasi — sinf, fan, xona va oʻquv yili maʼlumotnomalari.
 * Bu yerdagi maʼlumot butun tizim uchun asos: dars jadvali, qabul va
 * hisobotlar shu roʻyxatlarga tayanadi. Shu sabab faqat administrator
 * tahrirlaydi.
 */
export function ReferenceData() {
  const [tab, setTab] = useState<Tab>("classes");
  const { students } = useAdmin();

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students) {
      if (s.status !== "active") continue;
      map.set(s.className, (map.get(s.className) ?? 0) + 1);
    }
    return map;
  }, [students]);

  const subjects = useMemo(() => {
    const map = new Map<string, { teachers: Set<string>; classes: number; hours: number }>();
    for (const cls of CLASSES) {
      for (const row of subjectTeachersOf(cls.name)) {
        const entry = map.get(row.subject) ?? { teachers: new Set(), classes: 0, hours: 0 };
        entry.teachers.add(row.teacher.id);
        entry.classes += 1;
        entry.hours += row.hoursPerWeek;
        map.set(row.subject, entry);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].hours - a[1].hours);
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Maʼlumot bazasi</h1>
        <p className="text-sm text-foreground-muted">
          Sinflar, fanlar, xonalar va oʻquv yili — butun tizim shu roʻyxatlarga tayanadi
        </p>
      </div>

      <div role="tablist" aria-label="Maʼlumot boʻlimlari" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-brand text-brand-dark"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "classes" && (
        <Table
          head={["Sinf", "Bosqich", "Sinf rahbari", "Oʻquvchi", "Fanlar"]}
          rows={CLASSES.map((cls) => [
            <span key="n" className="font-medium text-foreground">
              {cls.name}
            </span>,
            <span key="s" className="capitalize text-foreground-muted">
              {cls.stage}
            </span>,
            homeroomTeacherOf(cls.name)?.fullName ?? "—",
            <span key="c" className="num">
              {counts.get(cls.name) ?? 0}
            </span>,
            <span key="f" className="num">
              {subjectTeachersOf(cls.name).length}
            </span>,
          ])}
        />
      )}

      {tab === "subjects" && (
        <Table
          head={["Fan", "Oʻqituvchilar", "Sinflar", "Haftalik soat"]}
          rows={subjects.map(([subject, info]) => [
            <span key="n" className="font-medium text-foreground">
              {subject}
            </span>,
            <span key="t" className="num">
              {info.teachers.size}
            </span>,
            <span key="c" className="num">
              {info.classes}
            </span>,
            <span key="h" className="num">
              {info.hours}
            </span>,
          ])}
        />
      )}

      {tab === "rooms" && (
        <Table
          head={["Xona", "Turi", "Sigʻimi", "Qavat"]}
          rows={ROOMS.map((room) => [
            <span key="n" className="num font-medium text-foreground">
              {room.number}
            </span>,
            room.kind,
            <span key="c" className="num">
              {room.capacity}
            </span>,
            <span key="f" className="num">
              {room.floor}
            </span>,
          ])}
        />
      )}

      {tab === "calendar" && (
        <div className="flex flex-col gap-4">
          <Table
            head={["Chorak", "Boshlanishi", "Tugashi", "Haftalar", "Holati"]}
            rows={QUARTERS.map((q) => [
              <span key="n" className="font-medium text-foreground">
                {q.name}
              </span>,
              <span key="f" className="num">
                {q.from}
              </span>,
              <span key="t" className="num">
                {q.to}
              </span>,
              <span key="w" className="num">
                {q.weeks}
              </span>,
              <Badge key="s" tone={q.status === "Joriy" ? "success" : "neutral"}>
                {q.status}
              </Badge>,
            ])}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Dars kunlari</h2>
              <ul className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => (
                  <li key={day}>
                    <Badge tone="brand">{day}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-foreground-muted">
                Yakshanba — dam olish kuni. Davomat va jadval shu roʻyxat boʻyicha
                hisoblanadi.
              </p>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Dars vaqtlari</h2>
              <ul className="grid grid-cols-2 gap-1.5 text-sm">
                {Object.entries(PERIOD_TIMES).map(([period, time]) => (
                  <li key={period} className="flex justify-between gap-2 rounded bg-surface-muted px-2 py-1">
                    <span className="num text-foreground-muted">{period}-dars</span>
                    <span className="num font-medium text-foreground">{time}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
        Jami:{" "}
        <span className="num font-medium text-foreground">{CLASSES.length}</span> sinf ·{" "}
        <span className="num font-medium text-foreground">{subjects.length}</span> fan ·{" "}
        <span className="num font-medium text-foreground">{allTeachers().length}</span> ustoz ·{" "}
        <span className="num font-medium text-foreground">{ROOMS.length}</span> xona · oylik
        shartnoma diapazoni {formatSom(3_000_000)} – {formatSom(4_000_000)}
      </p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="scroll-x">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {head.map((label) => (
                <th key={label} className="px-3 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr
                key={i}
                className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
              >
                {cells.map((cell, j) => (
                  <td key={j} className="px-3 py-2.5 text-foreground-muted">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
