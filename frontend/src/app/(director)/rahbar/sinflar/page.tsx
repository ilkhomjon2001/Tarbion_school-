import { LiveClassesBoard } from "@/components/director/LiveClassesBoard";

export const metadata = { title: "Sinflar — Tarbion rahbariyat" };

export default function ClassesPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-h2 font-bold text-foreground">Sinflar</h1>
        <p className="text-sm text-foreground-muted">
          Sinflar roʻyxati, sinf rahbarlari va oʻquvchilar davomati — bazadan
        </p>
      </div>
      <LiveClassesBoard />
    </div>
  );
}
