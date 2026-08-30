import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  EXAM_KIND_LABELS,
  examIdentityFor,
  examsOfClass,
  studentExamResults,
  TODAY,
} from "@/lib/school/exams";

/**
 * Imtihon natijalari — oʻquvchi va ota-ona kabinetlari uchun bitta
 * komponent. Manba `lib/school/exams.ts`: oʻquv boʻlimi kiritgan ball
 * shu yerda darhol koʻrinadi.
 *
 * Har bir natija yonida SINF OʻRTACHASI turadi — yolgʻiz ball hech narsa
 * aytmaydi, «72» yaxshimi yoki yomonmi sinf fonida bilinadi.
 */
export function ExamResultsCard({
  className,
  identityKey,
  title = "Imtihon natijalari",
}: {
  className: string;
  /** Kabinet oʻquvchisining barqaror kaliti — id yoki ismi. */
  identityKey: string;
  title?: string;
}) {
  const studentId = examIdentityFor(className, identityKey);
  const results = studentId ? studentExamResults(studentId) : [];
  const upcoming = examsOfClass(className)
    .filter((e) => e.date >= TODAY && e.status === "rejada")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const scored = results.filter((r) => !r.absent && r.score !== null);
  const average = scored.length
    ? Math.round(scored.reduce((sum, r) => sum + (r.score as number), 0) / scored.length)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-info/40 bg-info-tint p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-info">
            Yaqin imtihonlar
          </p>
          <ul className="flex flex-col gap-1.5">
            {upcoming.map((exam) => (
              <li key={exam.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="num font-medium text-foreground">{exam.date}</span>
                <span className="text-foreground">{exam.subject}</span>
                <span className="num text-xs text-foreground-muted">
                  {exam.startTime} · {exam.room}-xona
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState
          title="Natija yoʻq"
          description="Bu sinf boʻyicha hali imtihon natijasi kiritilmagan."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-foreground-muted">
              Oʻrtacha ball:{" "}
              <span
                className={`num font-semibold ${
                  average >= 80 ? "text-success" : average >= 60 ? "text-warning" : "text-danger"
                }`}
              >
                {average}
              </span>
            </p>
          </div>

          <ul className="divide-y divide-border">
            {results.map(({ exam, score, absent, classAverage }) => {
              const diff = score !== null ? score - classAverage : 0;
              return (
                <li key={exam.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {exam.subject}
                    </span>
                    <span className="block truncate text-xs text-foreground-muted">
                      {exam.date} · {EXAM_KIND_LABELS[exam.kind]}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    {absent ? (
                      <Badge tone="neutral">Kelmagan</Badge>
                    ) : (
                      <>
                        <span
                          className={`num block text-base font-bold ${
                            (score ?? 0) >= 80
                              ? "text-success"
                              : (score ?? 0) >= 60
                                ? "text-warning"
                                : "text-danger"
                          }`}
                        >
                          {score}
                        </span>
                        <span className="block text-[11px] text-foreground-muted">
                          sinf: <span className="num">{classAverage}</span>
                          {diff !== 0 && (
                            <span className={diff > 0 ? "text-success" : "text-danger"}>
                              {" "}
                              ({diff > 0 ? "+" : ""}
                              <span className="num">{diff}</span>)
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
