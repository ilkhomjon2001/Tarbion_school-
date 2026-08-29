import { Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { getParentRequests } from "@/lib/director/fetchers";
import type { RequestStatus } from "@/lib/director/types";

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "Yangi",
  in_progress: "Koʻrib chiqilmoqda",
  closed: "Yopilgan",
};

const STATUS_TONE: Record<RequestStatus, "info" | "warning" | "neutral"> = {
  new: "info",
  in_progress: "warning",
  closed: "neutral",
};

export default function ParentRequestsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Murojaatlar</h1>
        <p className="text-sm text-foreground-muted">Ota-onalardan kelgan xabarlar</p>
      </div>
      <Suspense fallback={<Card className="h-64 animate-pulse" />}>
        <RequestsSection />
      </Suspense>
    </div>
  );
}

async function RequestsSection() {
  const requests = await getParentRequests();
  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{r.subject}</p>
              <p className="text-xs text-foreground-muted">
                {r.parentName} · {r.studentFullName} ({r.className})
              </p>
            </div>
            <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
          </div>
          <p className="mt-2 text-sm text-foreground-muted">{r.message}</p>
          <p className="mt-2 text-[11px] text-foreground-muted">{r.createdAt}</p>
        </Card>
      ))}
    </div>
  );
}
