"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PlusIcon, UsersIcon } from "@/components/ui/icons";
import { reassignHomeroom } from "@/lib/director/data";
import {
  attendanceDaysOf,
  attendanceOf,
  classAttendanceStat,
  DAY_STATUS_LABELS,
  isAtRisk,
  MONTH_LABEL,
  schoolDaysOf,
  studentsOfClass,
  type AttendanceDay,
  type DayStatus,
} from "@/lib/director/school-data";
import { subjectTeachersOf } from "@/lib/school/staff";
import type { ClassStage, SchoolClass, Teacher } from "@/lib/director/types";

const STAGE_FILTERS: { id: ClassStage | "all"; label: string }[] = [
  { id: "all", label: "Barcha sinflar" },
  { id: "boshlangʻich", label: "Boshlangʻich" },
  { id: "oʻrta", label: "Oʻrta" },
  { id: "yuqori", label: "Yuqori" },
];

/** Sinf tafsilotidagi davomat davri. */
type ClassPeriod = "today" | "week" | "month";

const CLASS_PERIODS: { id: ClassPeriod; label: string }[] = [
  { id: "today", label: "Bugun" },
  { id: "week", label: "Haftalik" },
  { id: "month", label: "Oylik" },
];

export function ClassesBoard({
  classes: initialClasses,
  teachers: initialTeachers,
}: {
  classes: SchoolClass[];
  teachers: Teacher[];
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [teachers, setTeachers] = useState(initialTeachers);
  const [stage, setStage] = useState<ClassStage | "all">("all");
  const [selectedId, setSelectedId] = useState(initialClasses[0]?.id ?? "");
  const [editingHomeroom, setEditingHomeroom] = useState(false);
  const [draftTeacherId, setDraftTeacherId] = useState("");
  const [period, setPeriod] = useState<ClassPeriod>("today");

  const detailRef = useRef<HTMLDivElement>(null);
  // Sahifa ochilganda pastga sakramasin — faqat foydalanuvchi kartochka
  // bosgandan keyin siljitamiz.
  const userPicked = useRef(false);

  const filtered = useMemo(
    () => (stage === "all" ? classes : classes.filter((c) => c.stage === stage)),
    [classes, stage],
  );

  const selected = classes.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!userPicked.current) return;
    const node = detailRef.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [selectedId]);

  function selectClass(id: string) {
    userPicked.current = true;
    setSelectedId(id);
    setEditingHomeroom(false);
  }

  function openHomeroomEditor() {
    if (!selected) return;
    setDraftTeacherId(selected.homeroomTeacherId ?? "");
    setEditingHomeroom(true);
  }

  function saveHomeroom() {
    if (!selected) return;
    const result = reassignHomeroom(classes, teachers, selected.id, draftTeacherId || null);
    setClasses(result.classes);
    setTeachers(result.teachers);
    setEditingHomeroom(false);
  }

  // Yangi rahbar avvaldan boshqa sinfga biriktirilgan bo'lsa, ogohlantiramiz
  // (saqlashda u sinfdan avtomatik olib tashlanadi).
  const draftPreviousClass =
    draftTeacherId && classes.find((c) => c.homeroomTeacherId === draftTeacherId && c.id !== selected?.id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStage(f.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                stage === f.id
                  ? "bg-brand text-brand-foreground"
                  : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark focus-ring"
        >
          <PlusIcon className="h-4 w-4" />
          Yangi sinf
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((cls) => (
          <button
            key={cls.id}
            type="button"
            onClick={() => selectClass(cls.id)}
            aria-pressed={selected?.id === cls.id}
            className={`focus-ring rounded-xl border bg-surface p-4 text-left ${
              selected?.id === cls.id
                ? "border-brand shadow-sm ring-1 ring-brand"
                : "card-interactive border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-lg text-base font-bold ${
                  selected?.id === cls.id
                    ? "bg-brand text-brand-foreground"
                    : "bg-surface-muted text-foreground"
                }`}
              >
                {cls.name}
              </span>
              <span className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground-muted">
                <UsersIcon className="h-3.5 w-3.5" />
                {cls.studentCount}
              </span>
            </div>
            <p className="mt-3 text-xs text-foreground-muted">Sinf rahbari</p>
            <p className="text-sm font-medium text-foreground">
              {cls.homeroomTeacherName ?? <span className="italic text-foreground-muted">Tayinlanmagan</span>}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-foreground-muted">Oylik davomat</p>
              <p
                className={`text-sm font-semibold ${
                  cls.averageAttendance < 85 ? "text-danger" : "text-success"
                }`}
              >
                <span className="num">{cls.averageAttendance}%</span>
              </p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          ref={detailRef}
          key={selected.id}
          className="animate-enter mt-5 scroll-mt-24 rounded-xl border border-brand/40 bg-surface p-4 shadow-sm"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{selected.name} sinf</h2>

              {editingHomeroom ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={draftTeacherId}
                    onChange={(e) => setDraftTeacherId(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm focus-ring"
                  >
                    <option value="">Tayinlanmagan</option>
                    {teachers
                      .filter((t) => t.status === "active")
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={saveHomeroom}
                    className="h-9 rounded-lg bg-brand px-3 text-xs font-medium text-brand-foreground hover:bg-brand-dark"
                  >
                    Saqlash
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingHomeroom(false)}
                    className="h-9 rounded-lg px-3 text-xs font-medium text-foreground-muted hover:bg-surface-muted"
                  >
                    Bekor
                  </button>
                  {draftPreviousClass && (
                    <p className="basis-full text-xs text-warning">
                      Diqqat: bu ustoz hozir {draftPreviousClass.name} sinfiga rahbar — saqlansa,
                      u yerdan avtomatik olib tashlanadi.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-0.5 flex items-center gap-2 text-xs text-foreground-muted">
                  Rahbar:{" "}
                  <span className="font-medium text-foreground">
                    {selected.homeroomTeacherName ?? "Tayinlanmagan"}
                  </span>
                  <button
                    type="button"
                    onClick={openHomeroomEditor}
                    className="text-brand-dark underline-offset-2 hover:underline focus-ring"
                  >
                    Oʻzgartirish
                  </button>
                </p>
              )}
            </div>
            <span className="text-sm">
              <span className="num font-semibold text-foreground">{selected.studentCount}</span>{" "}
              <span className="text-foreground-muted">oʻquvchi</span>
            </span>
          </div>

          <ClassAttendance
            schoolClass={selected}
            period={period}
            onPeriodChange={setPeriod}
          />

          <SubjectTeachers className={selected.name} />

          <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Oʻquvchilar
          </h3>
          {selected.students.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground-muted">
              Roʻyxat hozircha boʻsh.
            </p>
          ) : (
            <StudentTable schoolClass={selected} period={period} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Sinf davomati uch davrda: bugungi holat (kim keldi/kelmadi) hamda
 * haftalik va oylik oʻrtacha. Bugungi kun bilan cheklanib qolsak,
 * "kecha ham shundaymidi" degan savolga javob boʻlmaydi.
 */
function ClassAttendance({
  schoolClass,
  period,
  onPeriodChange,
}: {
  schoolClass: SchoolClass;
  period: ClassPeriod;
  onPeriodChange: (next: ClassPeriod) => void;
}) {
  const total = schoolClass.students.length;
  const presentToday = schoolClass.students.filter((s) => s.status === "active").length;
  const todayPercent = total === 0 ? 0 : Math.round((presentToday / total) * 100);

  const stat =
    period === "today" ? null : classAttendanceStat(schoolClass.name, period);
  const percent = stat ? stat.averagePercent : todayPercent;

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface-muted/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
          Davomat
        </h3>
        <div
          role="group"
          aria-label="Davomat davri"
          className="flex gap-1 rounded-lg border border-border bg-surface p-1"
        >
          {CLASS_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodChange(p.id)}
              aria-pressed={period === p.id}
              className={`focus-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p.id
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span
          className={`num text-2xl font-bold ${
            isAtRisk(percent) ? "text-danger" : "text-success"
          }`}
        >
          {percent}%
        </span>
        <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-surface">
          <div
            className={`bar-fill h-full rounded-full ${
              percent >= 90 ? "bg-success" : percent >= 85 ? "bg-warning" : "bg-danger"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <p className="mt-1.5 text-xs text-foreground-muted">
        {period === "today" ? (
          <>
            Bugun <span className="num font-medium text-foreground">{presentToday}</span> ta
            oʻquvchi keldi,{" "}
            <span className="num font-medium text-danger">{total - presentToday}</span> ta kelmadi.
          </>
        ) : (
          <>
            {period === "week" ? "Shu haftadagi" : "Shu oydagi"} oʻrtacha davomat ·{" "}
            {stat && stat.atRiskCount > 0 ? (
              <>
                <span className="num font-medium text-danger">{stat.atRiskCount}</span> ta oʻquvchi
                85% dan past
              </>
            ) : (
              "xavf ostidagi oʻquvchi yoʻq"
            )}
          </>
        )}
      </p>
    </div>
  );
}

const DAY_CELL_CLASSES: Record<DayStatus, string> = {
  present: "bg-surface-muted text-foreground-muted",
  late: "bg-warning-tint text-warning",
  excused: "bg-info-tint text-info",
  absent: "bg-danger text-brand-foreground font-semibold",
};

/**
 * Oʻquvchilar roʻyxati.
 *   "Bugun"  — holat belgisi (keldi / kelmadi),
 *   hafta/oy — kunma-kun kalendar: qaysi sanada kelmagani koʻrinadi,
 *              yonida umumiy foiz.
 * Foizni koʻrsatishning oʻzi yetarli emas edi — "76%" nima uchun past
 * ekanini aytmaydi, kalendar esa aynan qaysi kunlar tushib qolganini
 * koʻrsatadi.
 */
function StudentTable({
  schoolClass,
  period,
}: {
  schoolClass: SchoolClass;
  period: ClassPeriod;
}) {
  const records = useMemo(() => {
    const map = new Map(studentsOfClass(schoolClass.name).map((s) => [s.id, s]));
    return schoolClass.students.map((student) => {
      const record = map.get(student.id);
      const calendarPeriod = period === "today" ? null : period;
      return {
        ...student,
        percent: record && calendarPeriod ? attendanceOf(record, calendarPeriod) : null,
        days: record && calendarPeriod ? attendanceDaysOf(record, calendarPeriod) : null,
      };
    });
  }, [schoolClass, period]);

  // Hafta/oy koʻrinishida eng past koʻrsatkich tepada tursin.
  const rows =
    period === "today"
      ? records
      : [...records].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0));

  const isCalendar = period !== "today";
  const days = isCalendar ? schoolDaysOf(period === "week" ? "week" : "month") : [];

  return (
    <div className={isCalendar ? "scroll-x" : undefined}>
      {isCalendar && <DayLegend />}

      <table
        className={`w-full border-collapse text-sm ${isCalendar ? "min-w-[720px]" : ""}`}
      >
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
            <th className="py-2">F.I.Sh</th>
            {isCalendar && (
              <th className="py-2 font-medium normal-case">
                <span className="flex items-center gap-[3px]">
                  {days.map((d) => (
                    <span
                      key={d.date}
                      className="num w-5 text-center text-[10px] tracking-normal"
                    >
                      {period === "week" ? d.weekdayShort : d.day}
                    </span>
                  ))}
                </span>
              </th>
            )}
            <th className="w-32 py-2">{isCalendar ? "Davomat" : "Status"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((student) => (
            <tr
              key={student.id}
              className="border-t border-border transition-colors hover:bg-surface-muted/50"
            >
              <td className="py-2.5 pr-3">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-foreground-muted">
                    {student.fullName
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")}
                  </span>
                  <span className="whitespace-nowrap">{student.fullName}</span>
                </span>
                {student.days && <MissedDates days={student.days} />}
              </td>

              {isCalendar && (
                <td className="py-2.5">
                  <span className="flex items-center gap-[3px]">
                    {student.days?.map((d) => (
                      <span
                        key={d.date}
                        title={`${d.day}-sentabr, ${d.weekdayShort} · ${DAY_STATUS_LABELS[d.status]}`}
                        className={`num flex h-5 w-5 items-center justify-center rounded text-[10px] ${DAY_CELL_CLASSES[d.status]}`}
                      >
                        {d.day}
                      </span>
                    ))}
                  </span>
                </td>
              )}

              <td className="py-2.5">
                {student.percent === null ? (
                  <Badge tone={student.status === "active" ? "success" : "danger"}>
                    {student.status === "active" ? "Faol" : "Sababsiz"}
                  </Badge>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                      <span
                        className={`bar-fill block h-full rounded-full ${
                          student.percent >= 90
                            ? "bg-success"
                            : student.percent >= 85
                              ? "bg-warning"
                              : "bg-danger"
                        }`}
                        style={{ width: `${student.percent}%` }}
                      />
                    </span>
                    <span
                      className={`num text-xs font-medium ${
                        isAtRisk(student.percent) ? "text-danger" : "text-foreground"
                      }`}
                    >
                      {student.percent}%
                    </span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Kalendar ranglari nimani anglatishi — legenda. */
function DayLegend() {
  const items: DayStatus[] = ["present", "late", "excused", "absent"];
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-foreground-muted">
      <span className="font-medium text-foreground">{MONTH_LABEL}</span>
      {items.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded ${DAY_CELL_CLASSES[status].split(" ")[0]}`}
          />
          {DAY_STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  );
}

/** Kelmagan sanalarni matn koʻrinishida — kalendarni sanamaslik uchun. */
function MissedDates({ days }: { days: AttendanceDay[] }) {
  const absent = days.filter((d) => d.status === "absent").map((d) => d.day);
  const excused = days.filter((d) => d.status === "excused").map((d) => d.day);

  if (absent.length === 0 && excused.length === 0) {
    return (
      <span className="mt-0.5 block pl-[38px] text-[11px] text-success">
        Bir kun ham qoldirmagan
      </span>
    );
  }

  return (
    <span className="mt-0.5 block pl-[38px] text-[11px] text-foreground-muted">
      {absent.length > 0 && (
        <>
          Sababsiz: <span className="num font-medium text-danger">{absent.join(", ")}</span>
          {"-sen"}
        </>
      )}
      {absent.length > 0 && excused.length > 0 && " · "}
      {excused.length > 0 && (
        <>
          Sababli: <span className="num font-medium text-info">{excused.join(", ")}</span>
          {"-sen"}
        </>
      )}
    </span>
  );
}

/** Sinfda qaysi fandan kim dars beradi — rahbariyat uchun. */
function SubjectTeachers({ className }: { className: string }) {
  const rows = subjectTeachersOf(className);

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        Fan oʻqituvchilari
      </h3>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-foreground-muted">
          Bu sinfga hali fan oʻqituvchilari biriktirilmagan.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {rows.map(({ subject, teacher, hoursPerWeek, isHomeroom }) => (
            <li
              key={`${subject}-${teacher.id}`}
              className="flex items-center gap-2.5 rounded-lg bg-surface-muted px-3 py-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold text-foreground-muted">
                {teacher.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {subject}
                </span>
                <span className="block truncate text-xs text-foreground-muted">
                  {teacher.fullName}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {isHomeroom && <Badge tone="brand">Rahbar</Badge>}
                <span className="mt-0.5 block text-[11px] text-foreground-muted">
                  <span className="num">{hoursPerWeek}</span> soat
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
