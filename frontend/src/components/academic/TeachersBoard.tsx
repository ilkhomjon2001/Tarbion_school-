"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { KPI_DEFINITIONS, kpiTone, teacherKpi } from "@/lib/director/teacher-kpi";
import { allTeachers, homeroomClassOf } from "@/lib/school/staff";
import { teacherExamSummary } from "@/lib/school/exams";
import { teacherQuality } from "@/lib/school/quality";

const TONE_TEXT = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

const TONE_BAR = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

type SortKey = "overall" | "exams" | "rules" | "parents" | "journal" | "quality" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  overall: "Umumiy KPI",
  exams: "Imtihon natijasi",
  rules: "Ichki qoidalar",
  parents: "Ota-ona hamkorligi",
  journal: "Jurnal intizomi",
  quality: "Dars kuzatuvi",
  name: "Ism boʻyicha",
};

/**
 * Ustozlar faoliyati — barcha ustozlar bitta jadvalda, KPI boʻyicha
 * saralanadi. Oʻquv boʻlimi shu yerdan kim bilan gaplashish kerakligini
 * koʻradi; tafsiloti rahbariyat kabinetidagi profilida.
 */
export function AcademicTeachersBoard() {
  const [sort, setSort] = useState<SortKey>("overall");

  const rows = useMemo(() => {
    const list = allTeachers().map((teacher) => {
      const kpi = teacherKpi(teacher.id);
      const exams = teacherExamSummary(teacher.id);
      const quality = teacherQuality(teacher.id);
      // Oʻlchanmagan koʻrsatkich `null` — 0 emas, aks holda saralashda
      // yuklamasi yoʻq ustoz eng pastga tushib qolardi.
      const byKey = new Map(
        kpi.scores.map((s) => [s.key, s.available ? s.score : null] as const),
      );
      return {
        teacher,
        kpi,
        exams,
        quality,
        scores: {
          overall: kpi.overall,
          exams: byKey.get("exams") ?? null,
          rules: byKey.get("rules") ?? null,
          parents: byKey.get("parents") ?? null,
          journal: byKey.get("journal") ?? null,
          // Kuzatuvi boʻlmagan ustoz roʻyxat oxirida — 0 ball emas.
          quality: quality.average,
        },
      };
    });

    if (sort === "name") {
      return list.sort((a, b) => a.teacher.fullName.localeCompare(b.teacher.fullName));
    }
    // Oʻlchanmaganlari roʻyxat oxirida — pastdagi ball emas, maʼlumot yoʻq.
    return list.sort((a, b) => {
      const x = a.scores[sort];
      const y = b.scores[sort];
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return y - x;
    });
  }, [sort]);

  const average = Math.round(
    rows.reduce((sum, r) => sum + r.kpi.overall, 0) / Math.max(1, rows.length),
  );

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Ustozlar faoliyati</h1>
          <p className="text-sm text-foreground-muted">
            Toʻrtta koʻrsatkich boʻyicha KPI · maktab oʻrtachasi{" "}
            <span className={`num font-semibold ${TONE_TEXT[kpiTone(average)]}`}>{average}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadCsv("tarbion-ustozlar-kpi", [
              [
                "Ustoz",
                "Fanlar",
                "Rahbarlik sinfi",
                "Umumiy KPI",
                "Imtihon",
                "Ichki qoidalar",
                "Ota-ona",
                "Jurnal",
                "Dars kuzatuvi",
                "Kuzatuv soni",
                "Imtihon soni",
                "Natija soni",
              ],
              ...rows.map((r) => [
                r.teacher.fullName,
                r.teacher.subjects.join(", "),
                homeroomClassOf(r.teacher.id) ?? "—",
                String(r.scores.overall),
                r.scores.exams === null ? "—" : String(r.scores.exams),
                r.scores.rules === null ? "—" : String(r.scores.rules),
                r.scores.parents === null ? "—" : String(r.scores.parents),
                r.scores.journal === null ? "—" : String(r.scores.journal),
                r.quality.average === null ? "—" : String(r.quality.average),
                String(r.quality.conducted),
                String(r.exams.examCount),
                String(r.exams.studentCount),
              ]),
            ])
          }
          className="focus-ring h-10 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          Hisobotni yuklab olish (CSV)
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            aria-pressed={sort === key}
            className={`focus-ring rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              sort === key
                ? "bg-brand text-brand-foreground"
                : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted"
            }`}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="scroll-x">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <th className="px-3 py-3">Ustoz</th>
                <th className="px-3 py-3">Umumiy</th>
                {KPI_DEFINITIONS.map((d) => (
                  <th key={d.key} className="px-3 py-3" title={d.formula}>
                    {d.label.split(" ")[0]}
                    {d.proposed && <span className="ml-1 text-warning">*</span>}
                  </th>
                ))}
                <th className="px-3 py-3" title="Dars kuzatuvining oʻrtacha bali">
                  Kuzatuv
                </th>
                <th className="px-3 py-3">Imtihon</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ teacher, kpi, exams, quality, scores }) => (
                <tr
                  key={teacher.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/50"
                >
                  <td className="px-3 py-2.5">
                    <span className="block font-medium text-foreground">{teacher.fullName}</span>
                    <span className="block text-xs text-foreground-muted">
                      {teacher.subjects.join(", ")}
                      {homeroomClassOf(teacher.id) ? ` · ${homeroomClassOf(teacher.id)}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span
                        className={`num w-8 text-sm font-bold ${TONE_TEXT[kpiTone(kpi.overall)]}`}
                      >
                        {kpi.overall}
                      </span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                        <span
                          className={`bar-fill block h-full rounded-full ${TONE_BAR[kpiTone(kpi.overall)]}`}
                          style={{ width: `${kpi.overall}%` }}
                        />
                      </span>
                    </span>
                  </td>
                  {(["exams", "rules", "parents", "journal"] as const).map((key) => {
                    const value = scores[key];
                    return (
                      <td key={key} className="px-3 py-2.5">
                        {value === null ? (
                          <span
                            className="text-xs text-foreground-muted"
                            title="Maʼlumot yoʻq — baholanmaydi"
                          >
                            —
                          </span>
                        ) : (
                          <span className={`num ${TONE_TEXT[kpiTone(value)]}`}>{value}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    {quality.average === null ? (
                      <span
                        className="text-xs text-foreground-muted"
                        title="Dars kuzatuvi oʻtkazilmagan"
                      >
                        —
                      </span>
                    ) : (
                      <span className="text-xs">
                        <span className={`num ${TONE_TEXT[kpiTone(quality.average)]}`}>
                          {quality.average}
                        </span>
                        <span className="text-foreground-muted">
                          {" "}
                          · {quality.conducted} ta
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-foreground-muted">
                    <span className="num">{exams.examCount}</span> ta ·{" "}
                    <span className="num">{exams.studentCount}</span> natija
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-foreground-muted">
          <span className="text-warning">*</span> «Jurnal va davomat intizomi» —
          rahbar tasdiqlamagan taklif. «Imtihon» ustuni haqiqiy natijalardan
          hisoblanadi, qolgan uchtasi hozircha demo maʼlumot.
        </p>
      </div>
    </div>
  );
}
