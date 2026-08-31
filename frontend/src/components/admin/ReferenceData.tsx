"use client";

import { useMemo, useState } from "react";
import { AcademicCalendarTab } from "@/components/admin/AcademicCalendarTab";
import { Badge } from "@/components/ui/Badge";
import { PlusIcon } from "@/components/ui/icons";
import { formatSom } from "@/lib/format";
import { useAdmin, useAdminDispatch } from "@/lib/admin/store";
import { allTeachers, staffById } from "@/lib/school/staff";

type Tab = "classes" | "subjects" | "rooms" | "calendar";

const TABS: { id: Tab; label: string }[] = [
  { id: "classes", label: "Sinflar" },
  { id: "subjects", label: "Fanlar" },
  { id: "rooms", label: "Xonalar" },
  { id: "calendar", label: "Oʻquv yili" },
];

/**
 * Maʼlumot bazasi — sinf, fan, xona va oʻquv yili maʼlumotnomalari.
 * Bu yerdagi maʼlumot butun tizim uchun asos: dars jadvali, qabul va
 * hisobotlar shu roʻyxatlarga tayanadi. Shu sabab faqat administrator
 * tahrirlaydi.
 */
export function ReferenceData() {
  const [tab, setTab] = useState<Tab>("classes");
  const { rooms, classes, subjects } = useAdmin();
  const activeRooms = rooms.filter((r) => r.status === "active");
  const activeClasses = classes.filter((c) => c.status === "active");
  const activeSubjects = subjects.filter((s) => s.status === "active");

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

      {tab === "classes" && <ClassesTab />}

      {tab === "subjects" && <SubjectsTab />}

      {tab === "rooms" && <RoomsTab />}

      {tab === "calendar" && <AcademicCalendarTab />}

      <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
        Jami:{" "}
        <span className="num font-medium text-foreground">{activeClasses.length}</span> sinf ·{" "}
        <span className="num font-medium text-foreground">{activeSubjects.length}</span> fan ·{" "}
        <span className="num font-medium text-foreground">{allTeachers().length}</span> ustoz ·{" "}
        <span className="num font-medium text-foreground">{activeRooms.length}</span> xona ·{" "}
        oylik shartnoma diapazoni {formatSom(3_000_000)} – {formatSom(4_000_000)}
      </p>
    </div>
  );
}

/**
 * Sinflar — yangi sinf ochish, sinf rahbarini va sigʻimni oʻzgartirish.
 *
 * Oʻquvchisi bor sinf arxivlanmaydi: avval oʻquvchilarni boshqa sinfga
 * koʻchirish kerak (Oʻquvchilar → tanlash → sinfni oʻzgartirish).
 */
function ClassesTab() {
  const { classes, students } = useAdmin();
  const dispatch = useAdminDispatch();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const [grade, setGrade] = useState(5);
  const [parallel, setParallel] = useState("");
  const [homeroom, setHomeroom] = useState(allTeachers()[0]?.id ?? "");
  const [capacity, setCapacity] = useState(30);

  const [editHomeroom, setEditHomeroom] = useState("");
  const [editCapacity, setEditCapacity] = useState(30);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students) {
      if (s.status !== "active") continue;
      map.set(s.className, (map.get(s.className) ?? 0) + 1);
    }
    return map;
  }, [students]);

  const newName = `${grade}-${parallel.trim().toUpperCase()}`;
  const duplicate =
    parallel.trim().length > 0 &&
    classes.some((c) => c.status === "active" && c.name === newName);
  const valid = parallel.trim().length > 0 && !duplicate && capacity > 0 && homeroom !== "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          Qabul sehrgarida shu roʻyxatdagi faol sinflar tanlanadi.
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Yangi sinf
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            dispatch({
              type: "ADD_CLASS",
              grade,
              parallel: parallel.trim().toUpperCase(),
              homeroomTeacherId: homeroom,
              capacity,
            });
            setParallel("");
            setAdding(false);
          }}
          className="animate-expand grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf raqami</span>
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className={refInputClass}
            >
              {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}-sinf
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Parallel harfi</span>
            <input
              value={parallel}
              onChange={(e) => setParallel(e.target.value.slice(0, 2))}
              placeholder="A, B, V…"
              className={refInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sinf rahbari</span>
            <select
              value={homeroom}
              onChange={(e) => setHomeroom(e.target.value)}
              className={refInputClass}
            >
              {allTeachers().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Sigʻimi</span>
            <input
              type="number"
              min={1}
              max={40}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className={refInputClass}
            />
          </label>

          {duplicate && (
            <p className="text-xs text-danger sm:col-span-4">
              {newName} sinfi allaqachon mavjud.
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
              Sinfni ochish
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">Sinf</th>
                <th className="px-3 py-3">Bosqich</th>
                <th className="px-3 py-3">Sinf rahbari</th>
                <th className="px-3 py-3">Oʻquvchi</th>
                <th className="px-3 py-3">Sigʻim</th>
                <th className="px-3 py-3">Holati</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => {
                const isEditing = editing === cls.id;
                const count = counts.get(cls.name) ?? 0;
                return (
                  <tr
                    key={cls.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{cls.name}</td>
                    <td className="px-3 py-2.5 capitalize text-foreground-muted">{cls.stage}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {isEditing ? (
                        <select
                          value={editHomeroom}
                          onChange={(e) => setEditHomeroom(e.target.value)}
                          className={refInputClass}
                        >
                          {allTeachers().map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.shortName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (staffById(cls.homeroomTeacherId)?.fullName ?? "—")
                      )}
                    </td>
                    <td className="num px-3 py-2.5 text-foreground-muted">{count}</td>
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={editCapacity}
                          onChange={(e) => setEditCapacity(Number(e.target.value))}
                          className={refInputClass}
                        />
                      ) : (
                        <span
                          className={`num ${count > cls.capacity ? "font-semibold text-danger" : "text-foreground-muted"}`}
                        >
                          {cls.capacity}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={cls.status === "active" ? "success" : "neutral"}>
                        {cls.status === "active" ? "Faol" : "Arxivda"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {cls.status !== "active" ? null : isEditing ? (
                        <span className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={editCapacity < 1}
                            onClick={() => {
                              dispatch({
                                type: "UPDATE_CLASS",
                                classId: cls.id,
                                homeroomTeacherId: editHomeroom,
                                capacity: editCapacity,
                              });
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
                        <span className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(cls.id);
                              setEditHomeroom(cls.homeroomTeacherId);
                              setEditCapacity(cls.capacity);
                            }}
                            className="focus-ring rounded px-2 py-1 text-xs font-medium text-brand-dark transition-colors hover:underline"
                          >
                            Tahrirlash
                          </button>
                          <button
                            type="button"
                            disabled={count > 0}
                            title={
                              count > 0
                                ? "Sinfda oʻquvchi bor — avval koʻchiring"
                                : "Sinfni arxivlash"
                            }
                            onClick={() => dispatch({ type: "ARCHIVE_CLASS", classId: cls.id })}
                            className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-foreground-muted"
                          >
                            Arxivlash
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
          Sinf oʻchirilmaydi — arxivlanadi, oʻtgan yillardagi baho va toʻlovlar
          hisobotda qoladi.
        </p>
      </div>
    </div>
  );
}

/** Fanlar — oʻquv rejasiga qoʻshish va undan chiqarish. */
function SubjectsTab() {
  const { subjects } = useAdmin();
  const dispatch = useAdminDispatch();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [hours, setHours] = useState(2);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);

  const duplicate = subjects.some(
    (s) => s.status === "active" && s.name.toLowerCase() === name.trim().toLowerCase(),
  );
  const valid = name.trim().length > 1 && hours > 0 && teacherIds.length > 0 && !duplicate;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          Dars jadvali va jurnal shu fanlar roʻyxatiga tayanadi.
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Yangi fan
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            dispatch({
              type: "ADD_SUBJECT",
              name: name.trim(),
              hoursPerWeek: hours,
              teacherIds,
            });
            setName("");
            setTeacherIds([]);
            setAdding(false);
          }}
          className="animate-expand flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Fan nomi</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Iqtisodiyot asoslari"
                className={refInputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">
                Haftalik soat (bitta sinfga)
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className={refInputClass}
              />
            </label>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-foreground">
              Oʻqituvchilar ({teacherIds.length} tanlandi)
            </legend>
            <div className="scroll-x flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border p-2">
              {allTeachers().map((teacher) => {
                const checked = teacherIds.includes(teacher.id);
                return (
                  <label
                    key={teacher.id}
                    className={`focus-ring cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      checked
                        ? "border-brand bg-brand-tint text-brand-dark"
                        : "border-border text-foreground-muted hover:bg-surface-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setTeacherIds((prev) =>
                          checked ? prev.filter((id) => id !== teacher.id) : [...prev, teacher.id],
                        )
                      }
                    />
                    {teacher.shortName}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {duplicate && <p className="text-xs text-danger">Bunday fan allaqachon bor.</p>}

          <div className="flex justify-end gap-2">
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
              Fanni qoʻshish
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">Fan</th>
                <th className="px-3 py-3">Oʻqituvchilar</th>
                <th className="px-3 py-3">Sinflar</th>
                <th className="px-3 py-3">Haftalik soat</th>
                <th className="px-3 py-3">Holati</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr
                  key={subject.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-3 py-2.5 font-medium text-foreground">{subject.name}</td>
                  <td className="px-3 py-2.5 text-foreground-muted">
                    <span className="num">{subject.teacherIds.length}</span>
                    {subject.teacherIds.length > 0 && (
                      <span className="ml-1.5 text-xs">
                        ({subject.teacherIds
                          .slice(0, 2)
                          .map((id) => staffById(id)?.shortName ?? "—")
                          .join(", ")}
                        {subject.teacherIds.length > 2 ? "…" : ""})
                      </span>
                    )}
                  </td>
                  <td className="num px-3 py-2.5 text-foreground-muted">{subject.classCount}</td>
                  <td className="num px-3 py-2.5 text-foreground-muted">{subject.hoursPerWeek}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={subject.status === "active" ? "success" : "neutral"}>
                      {subject.status === "active" ? "Oʻquv rejada" : "Chiqarilgan"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {subject.status === "active" && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "ARCHIVE_SUBJECT", subjectId: subject.id })}
                        className="focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger"
                      >
                        Rejadan chiqarish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
          Fan rejadan chiqarilsa yangi jadvalga qoʻshilmaydi, lekin oʻtgan
          baholar jurnalda qoladi.
        </p>
      </div>
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

const refInputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";
