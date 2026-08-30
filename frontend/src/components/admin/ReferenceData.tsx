"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PlusIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { useAdmin, useAdminDispatch } from "@/lib/admin/store";
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

/** Ikki sana orasidagi toʻliq haftalar soni. */
function weeksBetween(from: string, to: string): number {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  return Math.max(0, Math.round(days / 7));
}

/**
 * Maʼlumot bazasi — sinf, fan, xona va oʻquv yili maʼlumotnomalari.
 * Bu yerdagi maʼlumot butun tizim uchun asos: dars jadvali, qabul va
 * hisobotlar shu roʻyxatlarga tayanadi. Shu sabab faqat administrator
 * tahrirlaydi.
 */
export function ReferenceData() {
  const [tab, setTab] = useState<Tab>("classes");
  const { students, rooms, quarters } = useAdmin();
  const activeRooms = rooms.filter((r) => r.status === "active");

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

      {tab === "rooms" && <RoomsTab />}

      {tab === "calendar" && (
        <div className="flex flex-col gap-4">
          <QuartersTable />

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
        <span className="num font-medium text-foreground">{activeRooms.length}</span> xona ·{" "}
        <span className="num font-medium text-foreground">{quarters.length}</span> chorak · oylik
        shartnoma diapazoni {formatSom(3_000_000)} – {formatSom(4_000_000)}
      </p>
    </div>
  );
}

/** Xonalar — qoʻshish va foydalanishdan chiqarish mumkin. */
function RoomsTab() {
  const { rooms } = useAdmin();
  const dispatch = useAdminDispatch();
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState("");
  const [kind, setKind] = useState("Oddiy sinf xonasi");
  const [capacity, setCapacity] = useState(30);
  const [floor, setFloor] = useState(1);

  const duplicate = rooms.some(
    (r) => r.status === "active" && r.number.toLowerCase() === number.trim().toLowerCase(),
  );
  const valid = number.trim().length > 0 && capacity > 0 && !duplicate;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          Dars jadvali tuzishda shu roʻyxatdan xona tanlanadi.
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Yangi xona
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            dispatch({
              type: "ADD_ROOM",
              room: { number: number.trim(), kind, capacity, floor },
            });
            setNumber("");
            setAdding(false);
          }}
          className="animate-expand grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Xona raqami</span>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Masalan: 207"
              className={refInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Turi</span>
            <input
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={refInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sigʻimi</span>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className={refInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Qavat</span>
            <input
              type="number"
              min={1}
              max={5}
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              className={refInputClass}
            />
          </label>

          {duplicate && (
            <p className="text-xs text-danger sm:col-span-4">
              Bu raqamli xona allaqachon mavjud.
            </p>
          )}

          <div className="flex justify-end gap-2 sm:col-span-4">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="focus-ring rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="focus-ring rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              Xonani saqlash
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">Xona</th>
                <th className="px-3 py-3">Turi</th>
                <th className="px-3 py-3">Sigʻimi</th>
                <th className="px-3 py-3">Qavat</th>
                <th className="px-3 py-3">Holati</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr
                  key={room.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="num px-3 py-2.5 font-medium text-foreground">{room.number}</td>
                  <td className="px-3 py-2.5 text-foreground-muted">{room.kind}</td>
                  <td className="num px-3 py-2.5 text-foreground-muted">{room.capacity}</td>
                  <td className="num px-3 py-2.5 text-foreground-muted">{room.floor}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={room.status === "active" ? "success" : "neutral"}>
                      {room.status === "active" ? "Faol" : "Foydalanilmaydi"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {room.status === "active" && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "ARCHIVE_ROOM", roomId: room.id })}
                        className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger"
                      >
                        Chiqarish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
          Xona oʻchirilmaydi — foydalanishdan chiqariladi, eski jadvallarda nomi saqlanadi.
        </p>
      </div>
    </div>
  );
}

/** Chorak sanalari — bu yerdan oʻzgartiriladi. */
function QuartersTable() {
  const { quarters } = useAdmin();
  const dispatch = useAdminDispatch();
  const [editing, setEditing] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const today = "2026-09-20";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="scroll-x">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              <th className="px-3 py-3">Chorak</th>
              <th className="px-3 py-3">Boshlanishi</th>
              <th className="px-3 py-3">Tugashi</th>
              <th className="px-3 py-3">Haftalar</th>
              <th className="px-3 py-3">Holati</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {quarters.map((quarter) => {
              const isEditing = editing === quarter.id;
              const current = today >= quarter.from && today <= quarter.to;
              const invalid = isEditing && from >= to;
              return (
                <tr
                  key={quarter.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-3 py-2.5 font-medium text-foreground">{quarter.name}</td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className={refInputClass}
                      />
                    ) : (
                      <span className="num text-foreground-muted">{quarter.from}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className={refInputClass}
                      />
                    ) : (
                      <span className="num text-foreground-muted">{quarter.to}</span>
                    )}
                  </td>
                  <td className="num px-3 py-2.5 text-foreground-muted">
                    {weeksBetween(quarter.from, quarter.to)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={current ? "success" : "neutral"}>
                      {current ? "Joriy" : today > quarter.to ? "Tugagan" : "Rejada"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isEditing ? (
                      <span className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={invalid}
                          onClick={() => {
                            dispatch({ type: "UPDATE_QUARTER", quarterId: quarter.id, from, to });
                            setEditing(null);
                          }}
                          className="focus-ring rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground disabled:opacity-50"
                        >
                          Saqlash
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="focus-ring rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground-muted"
                        >
                          Bekor
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(quarter.id);
                          setFrom(quarter.from);
                          setTo(quarter.to);
                        }}
                        className="focus-ring rounded px-2 py-1 text-xs font-medium text-brand-dark transition-colors hover:underline"
                      >
                        Sanalarni oʻzgartirish
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
        Chorak sanalari jurnal, baho va hisobotlarga taʼsir qiladi — oʻzgarish audit
        jurnaliga tushadi.
      </p>
    </div>
  );
}

const refInputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

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
