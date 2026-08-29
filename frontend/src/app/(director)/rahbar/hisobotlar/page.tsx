import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { AreaLineChart, SimpleBarChart } from "@/components/director/charts";
import { getDirectorReports } from "@/lib/director/fetchers";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Hisobotlar va analitika</h1>
        <p className="text-sm text-foreground-muted">
          Baholar, davomat va fanlar boʻyicha umumiy koʻrsatkichlar
        </p>
      </div>
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsSection />
      </Suspense>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="h-64 animate-pulse" />
      ))}
    </div>
  );
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
        <h2 className="mb-3 text-base font-semibold text-foreground">Baholar taqsimoti</h2>
        <SimpleBarChart
          bars={data.gradeDistribution.map((b) => ({ label: `"${b.label}" baho`, value: b.count }))}
        />
      </Card>

      <Card className="lg:col-span-2">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Fanlar boʻyicha oʻrtacha baho
        </h2>
        <SimpleBarChart
          bars={data.subjectAverages.map((s) => ({ label: s.subject, value: s.average }))}
          toneVar="var(--color-info)"
          valueFormatter={(v) => v.toFixed(1)}
        />
      </Card>
    </div>
  );
}
