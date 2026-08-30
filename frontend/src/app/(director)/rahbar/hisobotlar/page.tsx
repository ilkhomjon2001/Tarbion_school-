import { Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AreaLineChart, SimpleBarChart } from "@/components/director/charts";
import { AttendanceByClass } from "@/components/director/AttendanceByClass";
import { ExportReportButton } from "@/components/director/ExportReportButton";
import { getDirectorReports } from "@/lib/director/fetchers";
import type { AtRiskReason } from "@/lib/director/types";

const RISK_LABELS: Record<AtRiskReason, string> = {
  attendance: "Davomat",
  grades: "Baho",
};

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Hisobotlar va analitika</h1>
          <p className="text-sm text-foreground-muted">
            Baholar, davomat, toʻlov va xavf ostidagi oʻquvchilar boʻyicha koʻrsatkichlar
          </p>
        </div>
        <Suspense fallback={null}>
          <ExportSection />
        </Suspense>
      </div>
      <AttendanceByClass />

      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsSection />
      </Suspense>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="h-64 animate-pulse" />
      ))}
    </div>
  );
}

async function ExportSection() {
  const data = await getDirectorReports();
  return <ExportReportButton data={data} />;
}

async function ReportsSection() {
  const data = await getDirectorReports();
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Davomat trendi (oxirgi 30 kun)
        </h2>
        <AreaLineChart
          points={data.attendanceTrend.map((p) => ({ label: p.dateLabel, value: p.percent }))}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Toʻlov yigʻilishi dinamikasi
        </h2>
        <AreaLineChart
          points={data.paymentTrend.map((p) => ({ label: p.monthLabel, value: p.collectedPercent }))}
          colorVar="var(--color-info)"
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold text-foreground">Baholar taqsimoti</h2>
        <SimpleBarChart
          bars={data.gradeDistribution.map((b) => ({ label: `"${b.label}" baho`, value: b.count }))}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Fanlar boʻyicha oʻrtacha baho
        </h2>
        <SimpleBarChart
          bars={data.subjectAverages.map((s) => ({ label: s.subject, value: s.average }))}
          toneVar="var(--color-info)"
          valueFormatter={(v) => v.toFixed(1)}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Sinflar boʻyicha oʻzlashtirish reytingi
        </h2>
        <SimpleBarChart
          bars={data.classRanking.map((c) => ({ label: c.className, value: c.averageGrade }))}
          toneVar="var(--color-success)"
          valueFormatter={(v) => v.toFixed(1)}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Xavf ostidagi oʻquvchilar
        </h2>
        {data.atRiskStudents.length === 0 ? (
          <p className="text-sm text-foreground-muted">Hozircha xavf ostidagi oʻquvchi yoʻq.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.atRiskStudents.map((student) => (
              <li
                key={student.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {student.fullName}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {student.className} sinf · {student.detail}
                  </p>
                </div>
                <Badge tone={student.reason === "attendance" ? "danger" : "warning"}>
                  {RISK_LABELS[student.reason]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
