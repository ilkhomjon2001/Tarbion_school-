import { ScheduleBoard } from "@/components/admin/ScheduleBoard";

export const metadata = { title: "Dars jadvali — Tarbion" };

/**
 * Dars jadvali (ADM-08, ADM-09).
 *
 * Maʼlumot serverdan. Tahrirlash `schedule.manage` huquqi bor
 * foydalanuvchiga ochiq — rahbar odatda faqat koʻradi.
 */
export default function DirectorSchedulePage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-h2 font-bold text-foreground">Dars jadvali</h1>
        <p className="text-sm text-foreground-muted">
          Sinf boʻyicha haftalik jadval. Bitta ustoz yoki xona ayni vaqtda ikki joyda
          boʻla olmaydi — saqlashda tekshiriladi.
        </p>
      </div>
      <ScheduleBoard />
    </div>
  );
}
