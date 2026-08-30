import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  KPI_DEFINITIONS,
  kpiTone,
  type KpiKey,
  type TeacherKpi,
} from "@/lib/director/teacher-kpi";

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

const DEFINITION_BY_KEY = new Map<KpiKey, (typeof KPI_DEFINITIONS)[number]>(
  KPI_DEFINITIONS.map((d) => [d.key, d]),
);

/**
 * Ustoz KPI paneli — maktab rahbari aytgan toʻrtta koʻrsatkich.
 *
 * Har bir ball ostida nimadan hisoblangani yozilgan: rahbar raqamni
 * tekshira olishi kerak, aks holda KPI ishonchsiz boʻlib qoladi.
 */
export function TeacherKpiPanel({ kpi }: { kpi: TeacherKpi }) {
  const overallTone = kpiTone(kpi.overall);

  return (
    <div className="flex flex-col gap-5">
      {/* Umumiy ball */}
      <Card className="animate-enter">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-baseline gap-2">
            <span className={`num text-4xl font-bold ${TONE_TEXT[overallTone]}`}>
              {kpi.overall}
            </span>
            <span className="text-sm text-foreground-muted">/ 100</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Umumiy KPI</p>
            <p className="text-xs text-foreground-muted">
              Toʻrtta koʻrsatkich oʻrtachasi ·{" "}
              <span className="num">{kpi.studentsTaught}</span> oʻquvchi ·{" "}
              <span className="num">{kpi.weeklyHours}</span> soat/hafta
              {kpi.homeroomClass ? ` · ${kpi.homeroomClass} sinf rahbari` : ""}
            </p>
          </div>
        </div>
      </Card>

      {/* Toʻrtta KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {kpi.scores.map((score, i) => {
          const definition = DEFINITION_BY_KEY.get(score.key);
          const tone = kpiTone(score.score);
          return (
            <Card
              key={score.key}
              className="animate-enter"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{definition?.label}</p>
                  {definition?.proposed && (
                    <span className="mt-1 inline-block">
                      <Badge tone="warning">Taklif — tasdiqlanmagan</Badge>
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className={`num text-2xl font-bold ${TONE_TEXT[tone]}`}>
                    {score.score}
                  </span>
                  <span
                    className={`num block text-xs ${
                      score.delta >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {score.delta >= 0 ? "+" : ""}
                    {score.delta} oʻtgan chorakka
                  </span>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`bar-fill h-full rounded-full ${TONE_BAR[tone]}`}
                  style={{ width: `${score.score}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-foreground">{score.detail}</p>
              <p className="mt-1 text-xs text-foreground-muted">{definition?.formula}</p>
            </Card>
          );
        })}
      </div>

      {/* Imtihon dinamikasi */}
      <Card>
        <h3 className="mb-1 text-base font-semibold text-foreground">
          Oylik imtihon natijalari dinamikasi
        </h3>
        <p className="mb-4 text-xs text-foreground-muted">
          Oʻquvchilarning 100 ballik shkaladagi oʻrtacha natijasi
        </p>
        <ul className="flex items-end gap-2">
          {kpi.examTrend.map((point) => (
            <li key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="num text-xs font-semibold text-foreground">{point.average}</span>
              <span
                className={`bar-fill w-full rounded-t ${TONE_BAR[kpiTone(point.average)]}`}
                style={{ height: `${Math.max(8, point.average * 1.2)}px` }}
                title={`${point.month}: ${point.average} ball`}
              />
              <span className="truncate text-[11px] text-foreground-muted">{point.month}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Fanlar va sinflar kesimi */}
      <Card>
        <h3 className="mb-1 text-base font-semibold text-foreground">
          Sinflar kesimida natija
        </h3>
        <p className="mb-3 text-xs text-foreground-muted">
          Eng yuqori natijadan pastga — qaysi sinfda qoʻshimcha ish kerakligi koʻrinadi
        </p>
        {kpi.subjects.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-6 text-center text-sm text-foreground-muted">
            Bu ustoz jadvalga biriktirilmagan.
          </p>
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[540px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  <th className="py-2 pr-3">Sinf va fan</th>
                  <th className="py-2 pr-3">Oʻquvchi</th>
                  <th className="py-2 pr-3">Imtihon bali</th>
                  <th className="py-2 pr-3">Oʻrtacha baho</th>
                  <th className="py-2">Davomat</th>
                </tr>
              </thead>
              <tbody>
                {kpi.subjects.map((row) => (
                  <tr
                    key={`${row.className}-${row.subject}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2 pr-3">
                      <span className="font-medium text-foreground">{row.className}</span>
                      <span className="text-foreground-muted"> · {row.subject}</span>
                    </td>
                    <td className="num py-2 pr-3 text-foreground-muted">{row.studentCount}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`num font-semibold ${TONE_TEXT[kpiTone(row.examAverage)]}`}
                      >
                        {row.examAverage}
                      </span>
                    </td>
                    <td className="num py-2 pr-3 text-foreground">{row.averageGrade}</td>
                    <td className="py-2">
                      <span
                        className={`num ${
                          row.attendancePercent < 90 ? "text-warning" : "text-foreground-muted"
                        }`}
                      >
                        {row.attendancePercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Ichki qoidalar */}
        <Card>
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Ichki qoidalarga amal qilish
          </h3>
          <ul className="flex flex-col gap-2.5">
            {kpi.rules.map((rule) => {
              const percent = Math.round((rule.done / rule.total) * 100);
              return (
                <li key={rule.label}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-foreground">{rule.label}</span>
                    <span className="num shrink-0 text-xs text-foreground-muted">
                      {rule.done}/{rule.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={`bar-fill h-full rounded-full ${TONE_BAR[kpiTone(percent)]}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Ota-ona hamkorligi */}
        <Card>
          <h3 className="mb-3 text-base font-semibold text-foreground">
            Ota-ona bilan hamkorlik
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Kelgan murojaat">
              <span className="num">{kpi.appealsReceived}</span> ta
            </Row>
            <Row label="Javob berilgan">
              <span
                className={`num ${
                  kpi.appealsAnswered < kpi.appealsReceived ? "text-warning" : "text-success"
                }`}
              >
                {kpi.appealsAnswered}
              </span>{" "}
              ta
            </Row>
            <Row label="Oʻrtacha javob vaqti">
              <span className={`num ${kpi.averageReplyHours > 24 ? "text-danger" : ""}`}>
                {kpi.averageReplyHours}
              </span>{" "}
              soat
            </Row>
            <Row label="Ota-onalar bahosi">
              <span className="num">{kpi.parentSurveyScore}</span> / 5
            </Row>
          </dl>
          <p className="mt-3 border-t border-border pt-2.5 text-xs text-foreground-muted">
            Baho administrator kabinetidagi soʻrovnoma natijalaridan va suhbat
            qaydnomalaridan yigʻiladi.
          </p>
        </Card>
      </div>

      <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
        Toʻrtinchi koʻrsatkich — «Jurnal va davomat intizomi» — taklif sifatida
        turibdi. Rahbar aytgan toʻrtinchi KPI aniqlashtirilgach almashtiriladi.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}
