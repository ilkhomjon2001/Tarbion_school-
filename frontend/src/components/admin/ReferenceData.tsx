"use client";

/**
 * Maʼlumot bazasi — sinf, fan, xona, oʻquv yili va dars jadvali
 * (ADM-02, ADM-03).
 *
 * Butun tizim shu roʻyxatlarga tayanadi: jadval, jurnal, qabul va
 * hisobotlar. Shu sabab uchta qoida serverda majburlanadi, bu yerda
 * faqat tushuntiriladi:
 *
 *   1. Hech narsa oʻchirilmaydi — arxivlanadi. Ketgan sinfning baholari
 *      va toʻlovlari hisobotda qolishi kerak.
 *   2. Ishlatilayotgan yozuv arxivlanmaydi: jadvalda turgan fan va
 *      oʻquvchisi bor sinf `409` beradi. Xabar serverdan koʻrsatiladi —
 *      u nima bilan band ekanini biladi.
 *   3. Arxivdagi bir xil nomli fan qayta yaratilmaydi, QAYTARILADI:
 *      oʻtgan baholar aynan oʻsha fanga bogʻlangan.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { AcademicCalendarTab } from "@/components/admin/AcademicCalendarTab";
import { ConfirmArchiveButton } from "@/components/admin/ConfirmArchiveButton";
import { ScheduleBoard } from "@/components/admin/ScheduleBoard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { GridIcon, PlusIcon } from "@/components/ui/icons";
import {
  apiXato,
  archiveClass,
  archiveSubject,
  createClass,
  createSubject,
  fetchClassSubjects,
  fetchSchedule,
  setClassSubject,
  setHomeroomTeacher,
  useSchoolDirectory,
  type ClassOut,
  type ClassSubjectOut,
  type SchoolDirectory,
  type StaffOut,
  type SubjectOut,
} from "@/lib/school/api";

type Tab = "classes" | "subjects" | "rooms" | "calendar" | "schedule";

const TABS: { id: Tab; label: string }[] = [
  { id: "classes", label: "Sinflar" },
  { id: "subjects", label: "Fanlar" },
  { id: "rooms", label: "Xonalar" },
  { id: "calendar", label: "Oʻquv yili" },
  { id: "schedule", label: "Dars jadvali" },
];

const refInputClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

const primaryBtn =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50";

const ghostBtn =
  "focus-ring inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50";

const linkBtn =
  "focus-ring rounded px-2 py-1 text-xs font-medium text-brand-dark transition-colors hover:underline disabled:opacity-40";

const archiveBtn =
  "focus-ring rounded px-2 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-danger disabled:opacity-40";

/** Sinf nomidan bosqich: «7-A» → oʻrta. Bu koʻrsatish uchun, bazada saqlanmaydi. */
function stageOf(name: string): string {
  const grade = Number.parseInt(name, 10);
  if (!Number.isFinite(grade)) return "—";
  if (grade <= 4) return "boshlangʻich";
  if (grade <= 9) return "oʻrta";
  return "yuqori";
}

function teachersOf(staff: StaffOut[]): StaffOut[] {
  return staff.filter(
    (s) => s.is_active && (s.roles.includes("teacher") || s.roles.includes("homeroom_teacher")),
  );
}

export function ReferenceData() {
  const [tab, setTab] = useState<Tab>("classes");
  const dir = useSchoolDirectory();

  // Uchala maʼlumotnoma tabi bir xil manbadan oziqlanadi, shuning
  // uchun yuklanish va xato holati ham bir joyda.
  const directoryTab = tab === "classes" || tab === "subjects" || tab === "rooms";

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Maʼlumot bazasi</h1>
        <p className="text-sm text-foreground-muted">
          Sinflar, fanlar, xonalar va oʻquv yili — butun tizim shu roʻyxatlarga tayanadi
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Maʼlumot boʻlimlari"
        className="flex flex-wrap gap-1 border-b border-border"
      >
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

      {directoryTab &&
        (dir.error ? (
          <div className="flex flex-col items-center gap-3">
            <ErrorState description={dir.error} />
            <button type="button" onClick={dir.reload} className={ghostBtn}>
              Qayta urinish
            </button>
          </div>
        ) : dir.loading ? (
          <ListSkeleton count={6} />
        ) : (
          <>
            {tab === "classes" && <ClassesTab dir={dir} />}
            {tab === "subjects" && <SubjectsTab dir={dir} />}
            {tab === "rooms" && <RoomsTab dir={dir} />}
          </>
        ))}

      {tab === "calendar" && <AcademicCalendarTab />}
      {tab === "schedule" && <ScheduleBoard />}

      {(tab === "classes" || tab === "subjects") && !dir.loading && !dir.error && (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
          Joriy oʻquv yilida{" "}
          <span className="num font-medium text-foreground">{dir.classes.length}</span> sinf ·{" "}
          <span className="num font-medium text-foreground">{dir.subjects.length}</span> fan ·{" "}
          <span className="num font-medium text-foreground">{teachersOf(dir.staff).length}</span>{" "}
          ustoz ·{" "}
          <span className="num font-medium text-foreground">
            {dir.classes.reduce((n, c) => n + c.student_count, 0)}
          </span>{" "}
          oʻquvchi
        </p>
      )}
    </div>
  );
}

// ────────────────────────────── Sinflar ──────────────────────────────

function ClassesTab({ dir }: { dir: SchoolDirectory }) {
  const { classes, staff, reload } = dir;
  const teachers = useMemo(() => teachersOf(staff), [staff]);

  const [adding, setAdding] = useState(false);
  const [grade, setGrade] = useState(5);
  const [parallel, setParallel] = useState("");
  const [homeroom, setHomeroom] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  const newName = `${grade}-${parallel.trim().toUpperCase()}`;
  const duplicate = parallel.trim().length > 0 && classes.some((c) => c.name === newName);
  const valid = parallel.trim().length > 0 && !duplicate;

  async function amal(f: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await f();
      reload();
    } catch (err) {
      // Server nima bilan band ekanini biladi: «7-A sinfida 27 oʻquvchi bor».
      setError(apiXato(err, "Amalni bajarib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  const planClass = plan === null ? null : (classes.find((c) => c.id === plan) ?? null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          Qabul sehrgarida shu roʻyxatdagi sinflar tanlanadi.
        </p>
        <button type="button" onClick={() => setAdding((v) => !v)} className={primaryBtn}>
          <PlusIcon className="h-4 w-4" />
          Yangi sinf
        </button>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            void amal(async () => {
              await createClass(newName, homeroom || null);
              setParallel("");
              setAdding(false);
            });
          }}
          className="animate-expand grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-3"
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
              <option value="">Keyinroq belgilanadi</option>
              {teachers.map((t) => (
                <option key={t.user_id} value={t.user_id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </label>

          {duplicate && (
            <p className="text-xs text-danger sm:col-span-3">{newName} sinfi allaqachon mavjud.</p>
          )}

          <div className="flex justify-end gap-2 sm:col-span-3">
            <button type="button" onClick={() => setAdding(false)} className={ghostBtn}>
              Bekor qilish
            </button>
            <button type="submit" disabled={!valid || busy} className={primaryBtn}>
              Sinfni ochish
            </button>
          </div>
        </form>
      )}

      {classes.length === 0 ? (
        <EmptyState
          icon={<GridIcon className="h-5 w-5" />}
          title="Sinf yoʻq"
          description="Joriy oʻquv yilida hali sinf ochilmagan. «Yangi sinf» bilan boshlang."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3">Bosqich</th>
                  <th className="px-3 py-3">Sinf rahbari</th>
                  <th className="px-3 py-3">Oʻquvchi</th>
                  <th className="px-3 py-3">Oʻquv reja</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr
                    key={cls.id}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{cls.name}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">{stageOf(cls.name)}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={cls.homeroom_teacher_id ?? ""}
                        disabled={busy}
                        aria-label={`${cls.name} sinf rahbari`}
                        onChange={(e) =>
                          void amal(() => setHomeroomTeacher(cls.id, e.target.value || null))
                        }
                        className={refInputClass}
                      >
                        <option value="">Belgilanmagan</option>
                        {teachers.map((t) => (
                          <option key={t.user_id} value={t.user_id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num px-3 py-2.5 text-foreground-muted">{cls.student_count}</td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setPlan(cls.id)} className={linkBtn}>
                        Fanlarni koʻrish
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <ConfirmArchiveButton
                        disabled={busy}
                        onConfirm={() => void amal(() => archiveClass(cls.id))}
                        question="Sinf arxivlansinmi?"
                        className={archiveBtn}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            Sinf oʻchirilmaydi — arxivlanadi, oʻtgan yillardagi baho va toʻlovlar hisobotda
            qoladi. Sinf rahbari biriktirilganda unga tegishli rol ham beriladi.
          </p>
        </div>
      )}

      {planClass && (
        <ClassPlan cls={planClass} subjects={dir.subjects} onClose={() => setPlan(null)} />
      )}
    </div>
  );
}

/**
 * Sinfning oʻquv rejasi (ADM-03): qaysi fan haftada necha soat.
 *
 * Soat 0 qilinsa fan rejadan chiqadi — bu ham arxivlash, oʻchirish emas.
 */
function ClassPlan({
  cls,
  subjects,
  onClose,
}: {
  cls: ClassOut;
  subjects: SubjectOut[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ClassSubjectOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addId, setAddId] = useState("");
  const [addHours, setAddHours] = useState(2);

  const yukla = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchClassSubjects(cls.id));
      setError(null);
    } catch (err) {
      setError(apiXato(err, "Oʻquv rejasini olib boʻlmadi."));
    } finally {
      setLoading(false);
    }
  }, [cls.id]);

  useEffect(() => {
    void yukla();
  }, [yukla]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saqla(subjectId: string, hours: number) {
    setBusy(true);
    setError(null);
    try {
      await setClassSubject(cls.id, subjectId, hours);
      await yukla();
    } catch (err) {
      setError(apiXato(err, "Saqlab boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  const qolgan = subjects.filter((s) => !rows.some((r) => r.subject_id === s.id));
  const jami = rows.reduce((n, r) => n + r.weekly_hours, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${cls.name} oʻquv rejasi`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-xl bg-surface p-4 shadow-xl sm:rounded-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">{cls.name} — oʻquv rejasi</h2>
            <p className="text-sm text-foreground-muted">
              Haftasiga <span className="num font-medium text-foreground">{jami}</span> soat
            </p>
          </div>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Yopish
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {loading ? (
          <ListSkeleton count={4} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.length === 0 && (
              <li className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
                Rejaga hali fan qoʻshilmagan.
              </li>
            )}
            {rows.map((r) => (
              <li
                key={r.subject_id}
                className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">{r.subject_name}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={r.weekly_hours}
                    disabled={busy}
                    aria-label={`${r.subject_name} haftalik soati`}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 1 && v !== r.weekly_hours) void saqla(r.subject_id, v);
                    }}
                    className="num h-8 w-16 rounded-lg border border-border bg-surface px-2 text-sm outline-none focus-visible:border-brand"
                  />
                  <span className="text-xs text-foreground-muted">soat</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saqla(r.subject_id, 0)}
                    className={archiveBtn}
                  >
                    Chiqarish
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {qolgan.length > 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!addId) return;
              void saqla(addId, addHours).then(() => setAddId(""));
            }}
            className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
          >
            <label className="min-w-[10rem] flex-1">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Fan qoʻshish</span>
              <select
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                className={refInputClass}
              >
                <option value="">Tanlang…</option>
                {qolgan.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium text-foreground">Soat</span>
              <input
                type="number"
                min={1}
                max={12}
                value={addHours}
                onChange={(e) => setAddHours(Number(e.target.value))}
                className={`${refInputClass} num w-20`}
              />
            </label>
            <button type="submit" disabled={!addId || busy} className={primaryBtn}>
              Qoʻshish
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────── Fanlar ───────────────────────────────

function SubjectsTab({ dir }: { dir: SchoolDirectory }) {
  const { subjects, staff, reload } = dir;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fanni kim oʻqitadi — xodimlar roʻyxatidan yigʻiladi, chunki
  // biriktirish aynan xodim kartochkasida boshqariladi (ADM-04).
  const teachersBySubject = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of teachersOf(staff)) {
      for (const id of s.subject_ids) {
        map.set(id, [...(map.get(id) ?? []), s.full_name]);
      }
    }
    return map;
  }, [staff]);

  const duplicate = subjects.some((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim().length > 1 && !duplicate;

  async function amal(f: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await f();
      reload();
    } catch (err) {
      setError(apiXato(err, "Amalni bajarib boʻlmadi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-muted">
          Dars jadvali va jurnal shu fanlar roʻyxatiga tayanadi.
        </p>
        <button type="button" onClick={() => setAdding((v) => !v)} className={primaryBtn}>
          <PlusIcon className="h-4 w-4" />
          Yangi fan
        </button>
      </div>

      {error && <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            void amal(async () => {
              await createSubject(name.trim(), shortName.trim());
              setName("");
              setShortName("");
              setAdding(false);
            });
          }}
          className="animate-expand grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-2"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Fan nomi</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan, Fizika"
              className={refInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Qisqartma (jadvalda)
            </span>
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value.slice(0, 20))}
              placeholder="Fiz"
              className={refInputClass}
            />
          </label>

          {duplicate && (
            <p className="text-xs text-danger sm:col-span-2">Bunday fan allaqachon bor.</p>
          )}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setAdding(false)} className={ghostBtn}>
              Bekor qilish
            </button>
            <button type="submit" disabled={!valid || busy} className={primaryBtn}>
              Fanni qoʻshish
            </button>
          </div>
        </form>
      )}

      {subjects.length === 0 ? (
        <EmptyState
          icon={<GridIcon className="h-5 w-5" />}
          title="Fan yoʻq"
          description="Oʻquv rejasi uchun avval fanlar qoʻshiladi."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Fan</th>
                  <th className="px-3 py-3">Qisqartma</th>
                  <th className="px-3 py-3">Ustozlar</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const ustozlar = teachersBySubject.get(s.id) ?? [];
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">{s.name}</td>
                      <td className="px-3 py-2.5 text-foreground-muted">{s.short_name || "—"}</td>
                      <td className="px-3 py-2.5 text-foreground-muted">
                        {ustozlar.length === 0 ? (
                          <Badge tone="warning">Biriktirilmagan</Badge>
                        ) : (
                          ustozlar.join(", ")
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <ConfirmArchiveButton
                          disabled={busy}
                          onConfirm={() => void amal(() => archiveSubject(s.id))}
                          question="Fan arxivlansinmi?"
                          className={archiveBtn}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            Ustoz biriktirish — Xodimlar boʻlimida. Arxivdagi fan oʻsha nomi bilan qayta
            qoʻshilsa oʻzi qaytadi: oʻtgan baholar unga bogʻlangan.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── Xonalar ───────────────────────────────

type RoomRow = { room: string; lessons: number; classes: Set<string> };

/**
 * Xonalar — dars jadvalidan yigʻiladi.
 *
 * Alohida «xonalar» jadvali YOʻQ: jadval yozuvida xona oddiy matn.
 * Shu sabab bu yerda oʻylab topilgan sigʻim va qavat koʻrsatilmaydi —
 * faqat haqiqatan band qilingan xonalar va ularning yuklamasi. Toʻliq
 * maʼlumotnoma (sigʻim, tur, qavat) sxema qarorini talab qiladi.
 */
function RoomsTab({ dir }: { dir: SchoolDirectory }) {
  const [rows, setRows] = useState<RoomRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSchedule()
      .then((entries) => {
        if (!alive) return;
        const map = new Map<string, RoomRow>();
        for (const e of entries) {
          const room = (e.room ?? "").trim();
          if (!room) continue;
          const row = map.get(room) ?? { room, lessons: 0, classes: new Set<string>() };
          row.lessons += 1;
          row.classes.add(e.class_name);
          map.set(room, row);
        }
        setRows([...map.values()].sort((a, b) => a.room.localeCompare(b.room, "uz")));
      })
      .catch(() => alive && setError("Jadvalni olib boʻlmadi."));
    return () => {
      alive = false;
    };
  }, [dir.classes.length]);

  if (error) return <ErrorState description={error} />;
  if (rows === null) return <ListSkeleton count={5} />;

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
        Xona dars jadvalida koʻrsatiladi va bu roʻyxat oʻshandan yigʻiladi. Yangi xona
        jadvalga dars qoʻshilganda paydo boʻladi.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={<GridIcon className="h-5 w-5" />}
          title="Xona koʻrsatilmagan"
          description="Dars jadvalida hali birorta darsga xona biriktirilmagan."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Xona</th>
                  <th className="px-3 py-3">Haftalik dars</th>
                  <th className="px-3 py-3">Sinflar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.room}
                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{r.room}</td>
                    <td className="num px-3 py-2.5 text-foreground-muted">{r.lessons}</td>
                    <td className="px-3 py-2.5 text-foreground-muted">
                      {[...r.classes].sort().join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
