import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  EXAMS,
  TODAY,
  examsAwaitingResults,
  statsOf,
  upcomingExams,
} from "@/lib/school/exams";
import { qualitySummary, qualityTone, upcomingObservations } from "@/lib/school/quality";
import { ACADEMIC_HEAD, allTeachers, staffById } from "@/lib/school/staff";
import { kpiTone, teacherKpi } from "@/lib/director/teacher-kpi";
import { CLASSES } from "@/lib/director/school-data";

const TONE_TEXT = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

/**
 * Oʻquv boʻlimi bosh sahifasi — kun boshida javob kerak boʻlgan uchta
 * savol: nima kutilmoqda, nima kechikdi, kimda muammo bor.
 */
export function AcademicDashboard() {
  const upcoming = upcomingExams(TODAY, 6);
  const awaiting = examsAwaitingResults(TODAY);
  const done = EXAMS.filter((e) => e.resultsEntered);

  // Oʻrtacha ball — natijasi bor imtihonlar boʻyicha.
  const allAverages = done
    .map((e) => statsOf(e.id)?.average ?? 0)
    .filter((n) => n > 0);
  const schoolAverage = allAverages.length
    ? Math.round(allAverages.reduce((a, b) => a + b, 0) / allAverages.length)
    : 0;

  // Eʼtibor talab qiladigan sinflar — oʻrtachasi 60 dan past.
  const weakClasses = CLASSES.map((cls) => {
    const exams = done.filter((e) => e.className === cls.name);
    const averages = exams.map((e) => statsOf(e.id)?.average ?? 0).filter((n) => n > 0);
    return {
      className: cls.name,
      average: averages.length
        ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length)
        : 0,
      examCount: exams.length,
    };
  })
    .filter((c) => c.examCount > 0)
    .sort((a, b) => a.average - b.average)
    .slice(0, 5);

  const quality = qualitySummary();
  const upcomingObs = upcomingObservations();

  // Eng past KPI li ustozlar.
  const weakTeachers = allTeachers()
    .map((t) => ({ teacher: t, kpi: teacherKpi(t.id) }))
    .sort((a, b) => a.kpi.overall - b.kpi.overall)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Oʻquv boʻlimi</h1>
        <p className="text-sm text-foreground-muted">
          {ACADEMIC_HEAD.fullName} · imtihonlar, dars rejasi va ustozlar faoliyati
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="animate-enter">
          <p className="text-sm text-foreground-muted">Yaqin imtihonlar</p>
          <p className="num mt-1 text-2xl font-bold text-foreground">{upcoming.length}</p>
          <p className="mt-1 text-xs text-foreground-muted">rejadagi eng yaqinlari</p>
        </Card>
        <Card className="animate-enter" style={{ animationDelay: "60ms" }}>
          <p className="text-sm text-foreground-muted">Natija kutilmoqda</p>
          <p
            className={`num mt-1 text-2xl font-bold ${
              awaiting.length > 0 ? "text-warning" : "text-success"
            }`}
          >
            {awaiting.length}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">oʻtdi, ball kiritilmagan</p>
        </Card>
        <Card className="animate-enter" style={{ animationDelay: "120ms" }}>
          <p className="text-sm text-foreground-muted">Maktab oʻrtachasi</p>
          <p
            className={`num mt-1 text-2xl font-bold ${
              schoolAverage >= 80
                ? "text-success"
                : schoolAverage >= 60
                  ? "text-warning"
                  : "text-danger"
            }`}
          >
            {schoolAverage}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            <span className="num">{done.length}</span> ta imtihon boʻyicha
          </p>
        </Card>
        <Card className="animate-enter" style={{ animationDelay: "180ms" }}>
          <p className="text-sm text-foreground-muted">Dars kuzatuvi</p>
          <p
            className={`num mt-1 text-2xl font-bold ${
              quality.average === null ? "text-foreground" : TONE_TEXT[qualityTone(quality.average)]
            }`}
          >
            {quality.average ?? "—"}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            <span className="num">{quality.conducted}</span> ta kuzatuv ·{" "}
            <span className="num">{allTeachers().length}</span> ustoz
          </p>
        </Card>
      </div>

      {(quality.awaitingScores > 0 || upcomingObs.length > 0) && (
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Sifat nazorati</h2>
            <Link
              href="/oquv-bolim/sifat"
              className="focus-ring rounded text-sm font-medium text-brand-dark hover:underline"
            >
              Kuzatuvlar →
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 px-4 py-3 text-sm">
            {quality.awaitingScores > 0 && (
              <p className="text-foreground-muted">
                Varaqasi kiritilmagan:{" "}
                <span className="num font-semibold text-warning">{quality.awaitingScores}</span> ta
              </p>
            )}
            {upcomingObs.length > 0 && (
              <p className="text-foreground-muted">
                Keyingi kuzatuv:{" "}
                <span className="num font-semibold text-foreground">{upcomingObs[0].date}</span> ·{" "}
                {staffById(upcomingObs[0].teacherId)?.shortName ?? "—"} · {upcomingObs[0].className}
              </p>
            )}
            {quality.weakest && (
              <p className="text-foreground-muted">
                Eng zaif mezon:{" "}
                <span className="font-semibold text-foreground">{quality.weakest.label}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {awaiting.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-warning/40 bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-warning-tint px-4 py-3">
            <h2 className="text-base font-semibold text-warning">
              Natijasi kiritilmagan imtihonlar
            </h2>
            <Link
              href="/oquv-bolim/imtihonlar"
              className="focus-ring rounded text-sm font-medium text-warning hover:underline"
            >
              Hammasi →
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {awaiting.slice(0, 5).map((exam) => (
              <li key={exam.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="num shrink-0 text-foreground-muted">{exam.date}</span>
                <span className="font-medium text-foreground">{exam.className}</span>
                <span className="text-foreground-muted">· {exam.subject}</span>
                <span className="ml-auto text-xs text-foreground-muted">
                  {staffById(exam.teacherId)?.shortName ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Yaqin imtihonlar</h2>
            <Link
              href="/oquv-bolim/imtihonlar"
              className="focus-ring rounded text-sm font-medium text-brand-dark hover:underline"
            >
              Jadval →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-foreground-muted">
              Rejada imtihon yoʻq.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((exam) => (
                <li key={exam.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="num shrink-0 rounded-md bg-brand-tint px-2 py-1 text-xs font-semibold text-brand-dark">
                    {exam.date.slice(5)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {exam.className} · {exam.subject}
                    </span>
                    <span className="num block text-xs text-foreground-muted">
                      {exam.startTime} · {exam.room}-xona
                    </span>
                  </span>
                  <Badge tone="info">Rejada</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">
              Eng past natijali sinflar
            </h2>
            <Link
              href="/oquv-bolim/natijalar"
              className="focus-ring rounded text-sm font-medium text-brand-dark hover:underline"
            >
              Natijalar →
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {weakClasses.map((c) => (
              <li key={c.className} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-14 shrink-0 text-sm font-medium text-foreground">
                  {c.className}
                </span>
                <span className="h-2 min-w-0 flex-1 rounded-full bg-surface-muted">
                  <span
                    className={`bar-fill block h-full rounded-full ${
                      c.average >= 80
                        ? "bg-success"
                        : c.average >= 60
                          ? "bg-warning"
                          : "bg-danger"
                    }`}
                    style={{ width: `${c.average}%` }}
                  />
                </span>
                <span
                  className={`num w-10 shrink-0 text-right text-sm font-semibold ${
                    c.average >= 80
                      ? "text-success"
                      : c.average >= 60
                        ? "text-warning"
                        : "text-danger"
                  }`}
                >
                  {c.average}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Eʼtibor talab qiladigan ustozlar
          </h2>
          <Link
            href="/oquv-bolim/ustozlar"
            className="focus-ring rounded text-sm font-medium text-brand-dark hover:underline"
          >
            Hammasi →
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {weakTeachers.map(({ teacher, kpi }) => (
            <li key={teacher.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand-dark">
                {teacher.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {teacher.fullName}
                </span>
                <span className="block truncate text-xs text-foreground-muted">
                  {teacher.subjects.join(", ")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`num block text-sm font-semibold ${TONE_TEXT[kpiTone(kpi.overall)]}`}>
                  {kpi.overall}
                </span>
                <span className="block text-xs text-foreground-muted">KPI</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
