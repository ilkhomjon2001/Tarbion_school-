"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TeacherShell } from "@/components/teacher/TeacherShell";
import { TopicField } from "@/components/teacher/TopicField";
import { GradeBook } from "@/components/teacher/GradeBook";
import { hasPlan, planFor } from "@/lib/teacher/plan";
import { canGrade } from "@/lib/teacher/roles";
import { conductedCount, getAttendance, saveAttendance } from "@/lib/teacher/store";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_ORDER,
  type AttendanceRow,
  type AttendanceStatus,
  type TeacherLesson,
} from "@/lib/teacher/types";

/**
 * Davomat belgilash (DAV-01, DAV-03) — panelning eng koʻp ishlatiladigan
 * ekrani. Ustoz kuniga 6 marta kiradi, shuning uchun:
 *
 *  - sukut boʻyicha HAMMASI "keldi", faqat istisnolar bosiladi
 *  - klaviatura bilan sichqonchasiz toʻldirish: ↓↑ yurish, 1-4 belgilash,
 *    Ctrl+S saqlash
 *  - saqlanmagan oʻzgarish bilan chiqishda ogohlantirish
 *  - DAV-03: dars tugaganidan 24 soat oʻtgan boʻlsa faqat oʻqish rejimi
 */

const STATUS_STYLES: Record<AttendanceStatus, { on: string; off: string }> = {
  present: {
    on: "bg-success text-brand-foreground border-success",
    off: "border-border text-foreground-muted hover:border-success hover:text-success",
  },
  absent: {
    on: "bg-danger text-brand-foreground border-danger",
    off: "border-border text-foreground-muted hover:border-danger hover:text-danger",
  },
  excused: {
    on: "bg-info text-brand-foreground border-info",
    off: "border-border text-foreground-muted hover:border-info hover:text-info",
  },
  late: {
    on: "bg-warning text-brand-foreground border-warning",
    off: "border-border text-foreground-muted hover:border-warning hover:text-warning",
  },
};

export default function AttendancePage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();

  const [lesson, setLesson] = useState<TeacherLesson | null>(null);
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /**
   * Davomat saqlangach jurnal SHU sahifada ochiladi — ustoz boshqa
   * ekranga oʻtmaydi. Ish ketma-ketligi bitta oynada: mavzu → davomat →
   * baho. Faqat oʻsha fandan baho qoʻyish huquqi bor ustozga (roles.ts).
   */
  const [journalOpen, setJournalOpen] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const journalRef = useRef<HTMLDivElement>(null);

  // Oʻtilgan mavzu — rejadan avtomatik toʻladi, ustoz tahrirlay oladi.
  const [topic, setTopic] = useState("");
  const [planIndex, setPlanIndex] = useState<number | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [planTopic, setPlanTopic] = useState<string | null>(null);

  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useEffect(() => {
    let alive = true;
    getAttendance(params.lessonId).then((data) => {
      if (!alive) return;
      if (!data) {
        setNotFound(true);
        return;
      }
      setLesson(data.lesson);
      setRows(data.rows);

      // Reja HAQIQATDA oʻtilgan darslar boʻyicha siljiydi (plan.ts ga qara).
      if (hasPlan(data.lesson.className)) {
        const done = conductedCount(
          data.lesson.className,
          data.lesson.subject,
          data.lesson.date,
        );
        const plan = planFor(data.lesson, done);
        setPlanIndex(plan?.index ?? null);
        setPlanLabel(plan?.title ? `${plan.human}-dars` : null);
        setPlanTopic(plan?.title?.title ?? null);
        setTopic(data.topic || plan?.title?.title || "");
      } else {
        setTopic(data.topic);
      }
    });
    return () => {
      alive = false;
    };
  }, [params.lessonId]);

  const readOnly = lesson ? !lesson.editable : false;

  const counts = useMemo(() => {
    const base: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      excused: 0,
      late: 0,
    };
    for (const row of rows ?? []) base[row.status] += 1;
    return base;
  }, [rows]);

  const setStatus = useCallback(
    (index: number, status: AttendanceStatus) => {
      if (readOnly) return;
      setRows((prev) => {
        if (!prev) return prev;
        if (prev[index].status === status) return prev;
        const next = [...prev];
        // Izoh faqat "kelmadi"/"sababli" uchun mantiqiy — holat "keldi" ga
        // qaytsa izoh tozalanadi, aks holda eski izoh adashtiradi.
        next[index] = {
          ...next[index],
          status,
          note: status === "present" ? "" : next[index].note,
        };
        return next;
      });
      setDirty(true);
    },
    [readOnly],
  );

  const setNote = useCallback(
    (index: number, note: string) => {
      if (readOnly) return;
      setRows((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        next[index] = { ...next[index], note };
        return next;
      });
      setDirty(true);
    },
    [readOnly],
  );

  const markAllPresent = useCallback(() => {
    if (readOnly) return;
    setRows((prev) =>
      prev ? prev.map((r) => ({ ...r, status: "present" as const, note: "" })) : prev,
    );
    setDirty(true);
  }, [readOnly]);

  const save = useCallback(async () => {
    if (!rows || readOnly || saving) return;
    setSaving(true);
    await saveAttendance(params.lessonId, rows, { topic, planIndex });
    setSaving(false);
    setDirty(false);
    setSavedAt(
      new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
    );

    // Baho qoʻyish huquqi bor ustozga jurnal shu yerda ochiladi.
    if (lesson && canGrade(lesson.className, lesson.subject)) {
      setSavedOnce(true);
      setJournalOpen(true);
    }
  }, [lesson, params.lessonId, planIndex, readOnly, rows, saving, topic]);

  // Jurnal ochilganda unga siljib boramiz — sahifa uzun, ustoz
  // qayerga qarashini oʻzi izlab oʻtirmasin.
  useEffect(() => {
    if (journalOpen) {
      journalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [journalOpen]);

  // --- Klaviatura yorliqlari ---
  useEffect(() => {
    if (!rows || readOnly) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (typing) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, (rows?.length ?? 1) - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        setStatus(activeIndex, ATTENDANCE_ORDER[Number(event.key) - 1]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, readOnly, rows, save, setStatus]);

  useEffect(() => {
    rowRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Saqlanmagan oʻzgarish bilan sahifadan chiqish — ogohlantirish.
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function goBack() {
    if (dirty && !window.confirm("Saqlanmagan oʻzgarishlar bor. Baribir chiqasizmi?")) {
      return;
    }
    router.push("/teacher");
  }

  if (notFound) {
    return (
      <TeacherShell title="Dars topilmadi">
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center">
          <p className="text-base font-medium">Bunday dars mavjud emas</p>
          <Link
            href="/teacher"
            className="mt-3 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand-dark"
          >
            Bugungi darslarga qaytish
          </Link>
        </div>
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      title={lesson ? `${lesson.className} · ${lesson.subject}` : "Davomat belgilash"}
      subtitle={
        lesson
          ? `${lesson.period}-para · ${lesson.startTime}–${lesson.endTime} · ${lesson.room}`
          : undefined
      }
      actions={
        !readOnly && rows ? (
          <button
            type="button"
            onClick={markAllPresent}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Hammasini keldi qilish
          </button>
        ) : null
      }
    >
      <button
        type="button"
        onClick={goBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Bugungi darslar
      </button>

      {readOnly && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-warning/30 bg-warning-tint px-4 py-3 text-sm text-warning"
        >
          <p className="font-medium">Bu darsni tahrirlash muddati tugagan.</p>
          <p className="mt-0.5">
            Dars tugaganidan 24 soat oʻtdi. Oʻzgartirish uchun administratorga
            murojaat qiling.
          </p>
        </div>
      )}

      {/* Oʻtilgan mavzu — jurnalga shu yoziladi (JUR-01) */}
      {rows !== null && (
        <div className="mb-4 rounded-xl border border-border bg-surface p-4">
          <TopicField
            value={topic}
            disabled={readOnly}
            planLabel={planLabel}
            planTopic={planTopic}
            onChange={(v) => {
              setTopic(v);
              setDirty(true);
            }}
          />
        </div>
      )}

      {rows === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="Yuklanmoqda">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : (
        <>
          {/* --- Katta ekran: jadval --- */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-surface lg:block">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Oʻquvchilar roʻyxati va davomat holatlari
              </caption>
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs uppercase tracking-wide text-foreground-muted">
                  <th scope="col" className="w-12 px-4 py-3 font-medium">№</th>
                  <th scope="col" className="px-4 py-3 font-medium">F.I.Sh.</th>
                  {ATTENDANCE_ORDER.map((status, i) => (
                    <th key={status} scope="col" className="px-2 py-3 text-center font-medium">
                      <span className="block">{ATTENDANCE_LABELS[status]}</span>
                      <span className="mt-0.5 block text-[10px] font-normal normal-case opacity-70">
                        ({i + 1})
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 font-medium">Izoh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isAbsent = row.status === "absent";
                  const isActive = index === activeIndex;
                  return (
                    <tr
                      key={row.studentId}
                      ref={(el) => {
                        rowRefs.current[index] = el;
                      }}
                      onClick={() => setActiveIndex(index)}
                      className={`border-b border-border last:border-0 transition-colors ${
                        isAbsent ? "bg-danger-tint/50" : ""
                      } ${isActive ? "ring-2 ring-inset ring-brand/40" : "hover:bg-surface-muted/40"}`}
                    >
                      <td className="relative px-4 py-2.5 text-foreground-muted">
                        {isAbsent && (
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 w-[3px] bg-danger"
                          />
                        )}
                        {index + 1}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{row.fullName}</td>
                      {ATTENDANCE_ORDER.map((status) => (
                        <td key={status} className="px-2 py-2.5 text-center">
                          <StatusButton
                            status={status}
                            selected={row.status === status}
                            disabled={readOnly}
                            studentName={row.fullName}
                            onSelect={() => setStatus(index, status)}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={row.note}
                          disabled={readOnly || row.status === "present"}
                          onChange={(e) => setNote(index, e.target.value)}
                          placeholder={
                            row.status === "present" ? "—" : "Sababni kiriting…"
                          }
                          aria-label={`${row.fullName} uchun izoh`}
                          className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none transition-colors placeholder:text-foreground-muted/50 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:bg-surface-muted/40 disabled:text-foreground-muted/50"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* --- Kichik ekran: kartalar (360px dan) --- */}
          <ul className="space-y-2.5 lg:hidden">
            {rows.map((row, index) => (
              <li
                key={row.studentId}
                className={`rounded-xl border bg-surface p-3 ${
                  row.status === "absent" ? "border-danger/40 bg-danger-tint/40" : "border-border"
                }`}
              >
                <p className="mb-2.5 font-medium">
                  <span className="mr-2 text-foreground-muted">{index + 1}.</span>
                  {row.fullName}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {ATTENDANCE_ORDER.map((status) => (
                    <StatusButton
                      key={status}
                      status={status}
                      selected={row.status === status}
                      disabled={readOnly}
                      studentName={row.fullName}
                      onSelect={() => setStatus(index, status)}
                      block
                    />
                  ))}
                </div>
                {row.status !== "present" && (
                  <input
                    type="text"
                    value={row.note}
                    disabled={readOnly}
                    onChange={(e) => setNote(index, e.target.value)}
                    placeholder="Sababni kiriting…"
                    aria-label={`${row.fullName} uchun izoh`}
                    className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
                  />
                )}
              </li>
            ))}
          </ul>

          {/* --- Pastdagi yopishib turuvchi panel --- */}
          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <Counter label="Jami" value={rows.length} />
                <Counter label="Keldi" value={counts.present} tone="text-success" />
                <Counter label="Kelmadi" value={counts.absent} tone="text-danger" />
                <Counter label="Sababli" value={counts.excused} tone="text-info" />
                <Counter label="Kechikdi" value={counts.late} tone="text-warning" />
              </dl>

              <div className="flex flex-wrap items-center gap-3">
                {savedAt && !dirty && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-success">
                    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l6 6L20 6" />
                    </svg>
                    Saqlandi · {savedAt}
                  </span>
                )}
                {dirty && (
                  <span className="text-sm text-warning">Saqlanmagan oʻzgarish bor</span>
                )}

                {/* Saqlangach jurnal shu yerdan ochiladi. */}
                {savedOnce && !journalOpen && (
                  <button
                    type="button"
                    onClick={() => setJournalOpen(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand px-4 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    Jurnalni ochish
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !dirty}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saqlanmoqda…" : "Davomatni saqlash"}
                  </button>
                )}
              </div>
            </div>

            {!readOnly && (
              <p className="mt-2 hidden text-xs text-foreground-muted lg:block">
                <Kbd>↓</Kbd> <Kbd>↑</Kbd> yurish · <Kbd>1</Kbd>–<Kbd>4</Kbd> holat
                belgilash · <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> saqlash
              </p>
            )}
          </div>

          {/* --- Jurnal: shu darsga baho qoʻyish (JUR-01) ---
              Davomat saqlangach shu yerda ochiladi. Ustoz boshqa ekranga
              oʻtmaydi: mavzu, davomat va baho bitta oynada. */}
          {journalOpen && lesson && (
            <section
              ref={journalRef}
              className="mt-6 scroll-mt-20 rounded-xl border border-brand/30 bg-surface p-4"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">
                    Jurnal — {lesson.className} · {lesson.subject}
                  </h2>
                  <p className="mt-0.5 text-sm text-foreground-muted">
                    {topic.trim()
                      ? <>Mavzu: <span className="text-foreground">{topic.trim()}</span></>
                      : "Mavzu biriktirilmagan — yuqoridagi maydonga yozing."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setJournalOpen(false)}
                  className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Yopish
                </button>
              </div>

              <GradeBook
                className={lesson.className}
                subject={lesson.subject}
                students={rows}
                editableDate={lesson.date}
                showSummary={false}
              />
            </section>
          )}
        </>
      )}
    </TeacherShell>
  );
}

function StatusButton({
  status,
  selected,
  disabled,
  studentName,
  onSelect,
  block,
}: {
  status: AttendanceStatus;
  selected: boolean;
  disabled: boolean;
  studentName: string;
  onSelect: () => void;
  block?: boolean;
}) {
  const style = STATUS_STYLES[status];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${studentName}: ${ATTENDANCE_LABELS[status]}`}
      disabled={disabled}
      onClick={onSelect}
      className={`inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${
        block ? "w-full" : ""
      } ${selected ? style.on : `bg-surface ${style.off}`}`}
    >
      {ATTENDANCE_LABELS[status]}
    </button>
  );
}

function Counter({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className={`font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-[11px]">
      {children}
    </kbd>
  );
}
