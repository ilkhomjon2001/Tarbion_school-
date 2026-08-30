"use client";

/**
 * Rahbariyat: murojaatlar (MUR-06) — bazadan.
 *
 * Rahbar butun maktab kesimini koʻradi: barcha murojaatlar, sinflar
 * boʻyicha statistika va javob muddati oʻtganlar soni. Kirish huquqi
 * serverda tekshiriladi — oʻquv boʻlimi bu boʻlimga kira olmaydi,
 * chunki murojaatda oilaviy va moliyaviy holat haqida gap boradi.
 */

import { LiveAppeals } from "@/components/shared/LiveAppeals";

export default function DirectorAppealsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Murojaatlar</h1>
        <p className="text-sm text-foreground-muted">
          Maktabga kelgan barcha murojaatlar — holat, masʼul va javob muddati bilan
        </p>
      </div>
      <LiveAppeals
        viewer="staff"
        title="Murojaatlar"
        hint="Rahbariyat yoki administrator hisobi bilan kiring."
      />
    </div>
  );
}
