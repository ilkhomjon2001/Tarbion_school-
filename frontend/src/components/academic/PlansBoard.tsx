"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpenIcon } from "@/components/ui/icons";
import { CLASSES } from "@/lib/director/school-data";
import { hasPlan, termPlan } from "@/lib/teacher/plan";
import { LESSONS_PER_TERM, TERMS, termForDate } from "@/lib/teacher/terms";
import { staffById, subjectTeachersOf } from "@/lib/school/staff";
import { TODAY } from "@/lib/school/exams";

/** Barqaror xesh — oʻtilgan darslar sonini demo uchun hosil qiladi. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface PlanRow {
  className: string;
  subject: string;
  teacherName: string;
  /** Chorak boshidan oʻtilgan darslar. */
  conducted: number;
  /** Rejada boʻlishi kerak boʻlgan dars soni (bugungi sanaga). */
  expected: number;
  planned: number;
  hasPlan: boolean;
}

/**
 * Dars rejalari nazorati.
 *
 * Savol: qaysi sinf rejadan orqada qolgan? Reja siljishi `lib/teacher/plan.ts`
 * dagi qoidaga tayanadi — OʻTILGAN darslar boʻyicha sanaladi, jadval
 * boʻyicha emas. Shu sabab dars bekor qilinsa reja oldinga ketmaydi va
 * orqada qolish shu yerda koʻrinadi.
 */
export function PlansBoard() {
  const [gradeFilter, setGradeFilter] = useState("all");
  const [onlyBehind, setOnlyBehind] = useState(false);

  const term = termForDate(TODAY) ?? TERMS[0];

  // Chorak boshidan bugungacha oʻtgan haftalar ulushi.
  const termProgress = useMemo(() => {
    const start = new Date(term.startsOn).getTime();
    const end = new Date(term.endsOn).getTime();
    const now = new Date(TODAY).getTime();
    return Math.max(0, Math.min(1, (now - start) / (end - start)));
  }, [term]);

  const rows = useMemo<PlanRow[]>(() => {
    const list: PlanRow[] = [];
    for (const cls of CLASSES) {
      for (const row of subjectTeachersOf(cls.name)) {
        const seed = hash(`plan-${cls.name}-${row.subject}`);
        const expected = Math.round(LESSONS_PER_TERM * termProgress);
        // Oʻtilgan darslar kutilganidan −4 … +1 oraligʻida tebranadi.
        const conducted = Math.max(0, Math.min(LESSONS_PER_TERM, expected - (seed % 6) + 1));
        list.push({
          className: cls.name,
          subject: row.subject,
          teacherName: staffById(row.teacher.id)?.shortName ?? "—",
          conducted,
          expected,
          planned: hasPlan(cls.name) ? termPlan(cls.name).length : 0,
          hasPlan: hasPlan(cls.name),
        });
      }
    }
    return list;
  }, [termProgress]);

  const shown = useMemo(() => {
    return rows
      .filter((r) => {
        if (gradeFilter !== "all" && !r.className.startsWith(`${gradeFilter}-`)) return false;
        if (onlyBehind && r.conducted >= r.expected) return false;
        return true;
      })
      .sort((a, b) => a.conducted - a.expected - (b.conducted - b.expected));
  }, [rows, gradeFilter, onlyBehind]);

  const grades = useMemo(
    () => [...new Set(CLASSES.map((c) => c.grade))].sort((a, b) => a - b),
    [],
  );

  const behind = rows.filter((r) => r.conducted < r.expected).length;
  const withoutPlan = rows.filter((r) => !r.hasPlan).length;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Dars rejalari</h1>
        <p className="text-sm text-foreground-muted">
          {term.name} · qaysi sinf rejadan orqada qolgani
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Chorak bosqichi" value={`${Math.round(termProgress * 100)}%`} hint={`${term.startsOn} — ${term.endsOn}`} />
        <Metric
          label="Rejadan orqada"
          value={String(behind)}
          hint="sinf va fan juftligi"
          tone={behind > 0 ? "warning" : "success"}
        />
        <Metric
          label="Rejasi yoʻq"
          value={String(withoutPlan)}
          hint="metodik baza toʻldirilmagan"
          tone={withoutPlan > 0 ? "danger" : "success"}
        />
        <Metric
          label="Chorakdagi darslar"
          value={String(LESSONS_PER_TERM)}
          hint="har bir fan uchun"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
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
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={onlyBehind}
            onChange={(e) => setOnlyBehind(e.target.checked)}
            className="focus-ring h-4 w-4 accent-[var(--color-brand)]"
          />
          Faqat orqada qolganlar
        </label>
        <p className="ml-auto text-xs text-foreground-muted">
          <span className="num">{shown.length}</span> ta qator
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<BookOpenIcon className="h-5 w-5" />}
          title="Qator topilmadi"
          description="Filtrni oʻzgartiring — yoki hamma reja boʻyicha ketyapti."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="scroll-x">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="px-3 py-3">Sinf</th>
                  <th className="px-3 py-3">Fan</th>
                  <th className="px-3 py-3">Ustoz</th>
                  <th className="px-3 py-3">Oʻtilgan / rejada</th>
                  <th className="px-3 py-3">Holati</th>
                  <th className="px-3 py-3">Metodik baza</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 120).map((row) => {
                  const gap = row.conducted - row.expected;
                  const percent = Math.round((row.conducted / LESSONS_PER_TERM) * 100);
                  return (
                    <tr
                      key={`${row.className}-${row.subject}`}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">{row.className}</td>
                      <td className="px-3 py-2.5 text-foreground">{row.subject}</td>
                      <td className="px-3 py-2.5 text-foreground-muted">{row.teacherName}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="num w-14 text-foreground">
                            {row.conducted} / {row.expected}
                          </span>
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted">
                            <span
                              className={`bar-fill block h-full rounded-full ${
                                gap >= 0 ? "bg-success" : gap >= -2 ? "bg-warning" : "bg-danger"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {gap >= 0 ? (
                          <Badge tone="success">Reja boʻyicha</Badge>
                        ) : gap >= -2 ? (
                          <Badge tone="warning">{Math.abs(gap)} dars orqada</Badge>
                        ) : (
                          <Badge tone="danger">{Math.abs(gap)} dars orqada</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.hasPlan ? (
                          <span className="num text-xs text-foreground-muted">
                            {row.planned} ta mavzu
                          </span>
                        ) : (
                          <span className="text-xs text-danger">toʻldirilmagan</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
            Reja siljishi OʻTILGAN darslar boʻyicha sanaladi — dars bekor
            qilinsa reja oldinga ketmaydi va orqada qolish shu yerda koʻrinadi.
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const valueClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : "text-foreground";
  return (
    <div className="animate-enter rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}
