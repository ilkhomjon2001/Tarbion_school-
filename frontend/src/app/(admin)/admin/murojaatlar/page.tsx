"use client";

/**
 * Administrator: murojaatlar va yozishmalar — bazadan.
 *
 * Ichki suhbat qaydlari (telefon/yuzma-yuz/onlayn) shu yerda: ular
 * `appeal_notes` jadvalida saqlanadi va ota-onaga ham, ustozga ham
 * koʻrsatilmaydi. Bu cheklov backendda — alohida endpoint va alohida
 * rol roʻyxati.
 */

import { LiveAppeals } from "@/components/shared/LiveAppeals";

export default function AdminConversationsPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Murojaatlar</h1>
        <p className="text-sm text-foreground-muted">
          Ota-onalar bilan yozishma va ichki suhbat qaydlari
        </p>
      </div>
      <LiveAppeals
        viewer="staff"
        title="Murojaatlar"
        hint="Administrator hisobi bilan kiring."
      />
    </div>
  );
}
