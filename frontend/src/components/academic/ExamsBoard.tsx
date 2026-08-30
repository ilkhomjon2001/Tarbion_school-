"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardIcon, PlusIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv";
import {
  EXAM_KIND_LABELS,
  EXAM_STATUS_LABELS,
  EXAMS,
  TODAY,
  statsOf,
  type Exam,
  type ExamKind,
} from "@/lib/school/exams";
import { CLASSES } from "@/lib/director/school-data";
import { staffById, subjectTeachersOf } from "@/lib/school/staff";

type Filter = "all" | "rejada" | "otkazildi" | "natijasiz";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Barchasi",
  rejada: "Rejada",
  otkazildi: "Oʻtkazilgan",
  natijasiz: "Natija kutilmoqda",
};

/**
 * Imtihonlar jadvali — oʻquv boʻlimining asosiy ish joyi.
 *
 * Imtihon eʼlon qilinadi, oʻtkaziladi, natijasi kiritiladi. Natija
 * `lib/school/exams.ts` ga tushadi va oʻsha yerdan ustoz KPI siga,
 * oʻquvchi va ota-ona kabinetlariga tarqaladi — ikkinchi roʻyxat
 * yuritilmaydi.
 */
export function ExamsBoard() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [creating, setCreating] = useState(false);

  const grades = useMemo(
    () => [...new Set(CLASSES.map((c) => c.grade))].sort((a, b) => a - b),
    [],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXAMS.filter((e) => {
      if (filter === "rejada" && e.status !== "rejada") return false;
      if (filter === "otkazildi" && !e.resultsEntered) return false;
      if (filter === "natijasiz" && (e.resultsEntered || e.date >= TODAY)) return false;
      if (gradeFilter !== "all" && !e.className.startsWith(`${gradeFilter}-`)) return false;
      if (!q) return true;
      return (
        e.subject.toLowerCase().includes(q) ||
        e.className.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)
      );
    });
  }, [filter, query, gradeFilter]);

  const summary = useMemo(() => {
    const planned = EXAMS.filter((e) => e.status === "rejada").length;
    const done = EXAMS.filter((e) => e.resultsEntered).length;
    const waiting = EXAMS.filter((e) => e.date < TODAY && !e.resultsEntered).length;
    return { planned, done, waiting, total: EXAMS.length };
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Imtihonlar</h1>
          <p className="text-sm text-foreground-muted">
            Imtihon eʼlon qilish, jadvalni boshqarish va natija kiritish
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv("tarbion-imtihonlar", [
                ["Sana", "Vaqt", "Sinf", "Fan", "Turi", "Xona", "Ustoz", "Holati", "Oʻrtacha ball"],
                ...rows.map((e) => [
                  e.date,
                  e.startTime,
                  e.className,
                  e.subject,
                  EXAM_KIND_LABELS[e.kind],
                  e.room,
                  staffById(e.teacherId)?.shortName ?? "—",
                  EXAM_STATUS_LABELS[e.status],
                  e.resultsEntered ? String(statsOf(e.id)?.average ?? "—") : "—",
                ]),
              ])
            }
            className="focus-ring h-10 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            Jadvalni yuklab olish (CSV)
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            <PlusIcon className="h-4 w-4" />
            Imtihon eʼlon qilish
          </button>
        </div>
      </div>

      {creating && <ExamComposer onClose={() => setCreating(false)} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Jami imtihon" value={summary.total} hint="oʻquv yili boʻyicha" />
        <SummaryCard label="Rejada" value={summary.planned} hint="hali oʻtkazilmagan" tone="info" />
        <SummaryCard label="Natijasi bor" value={summary.done} hint="ball kiritilgan" tone="success" />
        <SummaryCard
          label="Natija kutilmoqda"
          value={summary.waiting}
          hint="oʻtdi, ball yoʻq"
          tone={summary.waiting > 0 ? "warning" : "success"}
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fan yoki sinf boʻyicha qidirish…"
            aria-label="Imtihonlarni qidirish"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-foreground-muted/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          aria-label="Sinf darajasi"
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Barcha sinflar</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}-sinflar
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`focus-ring h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
                filter === key
                  ? "bg-brand text-brand-foreground"
                  : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
              }`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon className="h-5 w-5" />}
          title="Imtihon topilmadi"
          description="Filtrni oʻzgartiring yoki yangi imtihon eʼlon qiling."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Sana va vaqt</th>
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3">Fan</th>
                  <th className="px-3 py-3">Ustoz</th>
                  <th className="px-3 py-3">Xona</th>
                  <th className="px-3 py-3">Holati</th>
                  <th className="px-3 py-3">Natija</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((exam) => (
                  <ExamRow key={exam.id} exam={exam} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            {rows.length > 100 && (
              <>
                Birinchi <span className="num">100</span> tasi koʻrsatildi (jami{" "}
                <span className="num">{rows.length}</span>).{" "}
              </>
            )}
            Natija kiritilgach ustoz KPI si va oʻquvchi kabinetidagi ball
            avtomatik yangilanadi.
          </p>
        </div>
      )}
    </div>
  );
}

function ExamRow({ exam }: { exam: Exam }) {
  const stats = exam.resultsEntered ? statsOf(exam.id) : null;
  const teacher = staffById(exam.teacherId);
  const overdue = exam.date < TODAY && !exam.resultsEntered;

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50">
      <td className="whitespace-nowrap px-3 py-2.5">
        <span className="num block text-foreground">{exam.date}</span>
        <span className="num block text-xs text-foreground-muted">
          {exam.startTime} · {exam.durationMin} daq
        </span>
      </td>
      <td className="px-3 py-2.5 font-medium text-foreground">{exam.className}</td>
      <td className="px-3 py-2.5">
        <span className="block text-foreground">{exam.subject}</span>
        <span className="block text-xs text-foreground-muted">
          {EXAM_KIND_LABELS[exam.kind]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-foreground-muted">{teacher?.shortName ?? "—"}</td>
      <td className="num px-3 py-2.5 text-foreground-muted">{exam.room}</td>
      <td className="px-3 py-2.5">
        <Badge
          tone={
            overdue ? "warning" : exam.status === "rejada" ? "info" : "success"
          }
        >
          {overdue ? "Natija kutilmoqda" : EXAM_STATUS_LABELS[exam.status]}
        </Badge>
      </td>
      <td className="px-3 py-2.5">
        {stats ? (
          <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <span
              className={`num text-sm font-semibold ${
                stats.average >= 80
                  ? "text-success"
                  : stats.average >= 60
                    ? "text-warning"
                    : "text-danger"
              }`}
            >
              {stats.average}
            </span>
            <span className="text-foreground-muted">
              oʻrtacha · {stats.entered} ta natija
            </span>
            {stats.failing > 0 && (
              <span className="text-danger">{stats.failing} ta «2»</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-foreground-muted">
            {overdue ? "kiritilmagan" : "—"}
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Yangi imtihon eʼlon qilish.
 *
 * DEMO: imtihonlar `lib/school/exams.ts` da generatsiya qilinadi va
 * oʻzgarmas — shu sabab bu forma tekshiruvlarni va toʻqnashuv nazoratini
 * koʻrsatadi, lekin roʻyxatga yozmaydi. Backend ulanganda `POST /exams`
 * chaqiruviga ulanadi.
 */
function ExamComposer({ onClose }: { onClose: () => void }) {
  const [className, setClassName] = useState(CLASSES[0]?.name ?? "");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<ExamKind>("oylik");
  const [date, setDate] = useState("2026-11-16");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [room, setRoom] = useState("204");
  const [sent, setSent] = useState(false);

  const subjects = useMemo(() => subjectTeachersOf(className), [className]);
  const teacher = subjects.find((s) => s.subject === subject)?.teacher ?? subjects[0]?.teacher;

  // Toʻqnashuv: shu sana va vaqtda xona yoki ustoz band boʻlsa.
  const conflicts = useMemo(() => {
    const list: string[] = [];
    for (const e of EXAMS) {
      if (e.date !== date || e.startTime !== startTime) continue;
      if (e.room === room) list.push(`${room}-xona band: ${e.className} · ${e.subject}`);
      if (teacher && e.teacherId === teacher.id) {
        list.push(`${teacher.shortName} band: ${e.className} · ${e.subject}`);
      }
      if (e.className === className) list.push(`${className} da shu vaqtda imtihon bor`);
    }
    return [...new Set(list)];
  }, [date, startTime, room, teacher, className]);

  const problems: string[] = [];
  if (!subject) problems.push("Fanni tanlang.");
  if (!date) problems.push("Sanani kiriting.");
  if (duration < 20) problems.push("Davomiylik kamida 20 daqiqa boʻlsin.");

  return (
    <div className="animate-expand rounded-xl border border-brand/40 bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Yangi imtihon</h2>
          <p className="text-xs text-foreground-muted">
            Sinf, fan va vaqt tanlanadi — ustoz avtomatik biriktiriladi
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Sinf">
          <select
            value={className}
            onChange={(e) => {
              setClassName(e.target.value);
              setSubject("");
              setSent(false);
            }}
            className={examInput}
          >
            {CLASSES.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fan">
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setSent(false);
            }}
            className={examInput}
          >
            <option value="">Tanlang…</option>
            {subjects.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject} ({s.teacher.shortName})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Turi">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ExamKind)}
            className={examInput}
          >
            {(Object.keys(EXAM_KIND_LABELS) as ExamKind[]).map((k) => (
              <option key={k} value={k}>
                {EXAM_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sana">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSent(false);
            }}
            className={examInput}
          />
        </Field>

        <Field label="Boshlanish vaqti">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={examInput}
          />
        </Field>

        <Field label="Davomiyligi (daqiqa)">
          <input
            type="number"
            min={20}
            max={180}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={`${examInput} num`}
          />
        </Field>

        <Field label="Xona">
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className={`${examInput} num`}
          />
        </Field>
      </div>

      {conflicts.length > 0 && (
        <ul className="animate-enter mt-3 space-y-1 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">
          {conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      {problems.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {sent && (
        <p className="animate-enter mt-3 rounded-lg bg-success-tint px-3 py-2 text-xs text-success">
          Imtihon eʼlon qilindi. DEMO: roʻyxat mock maʼlumotdan qurilgani uchun
          jadvalda koʻrinmaydi — backend ulanganda saqlanadi.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-foreground-muted">
          {teacher ? (
            <>
              Oʻtkazadi: <span className="font-medium text-foreground">{teacher.fullName}</span>
            </>
          ) : (
            "Fan tanlanmagan"
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={problems.length > 0 || conflicts.length > 0}
            onClick={() => setSent(true)}
            className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            Eʼlon qilish
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "neutral" | "info" | "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "info"
          ? "text-info"
          : "text-foreground";
  return (
    <div className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}

const examInput =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
