import { AppealsBoard } from "@/components/director/AppealsBoard";
import { APPEALS } from "@/lib/school/appeals";

export default function ParentRequestsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Murojaatlar</h1>
        <p className="text-sm text-foreground-muted">
          Maktabga kelgan barcha murojaatlar — rahbariyatga va ustozlarga alohida
        </p>
      </div>
      <AppealsBoard appeals={APPEALS} />
    </div>
  );
}
