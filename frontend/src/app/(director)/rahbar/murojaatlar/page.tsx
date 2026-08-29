import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { ParentRequestCard } from "@/components/director/ParentRequestCard";
import { getParentRequests } from "@/lib/director/fetchers";

export default function ParentRequestsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Murojaatlar</h1>
        <p className="text-sm text-foreground-muted">
          Ota-onalardan kelgan xabarlar — javob yozing yoki murojaatni yoping
        </p>
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
        <ParentRequestCard key={r.id} request={r} />
      ))}
    </div>
  );
}
