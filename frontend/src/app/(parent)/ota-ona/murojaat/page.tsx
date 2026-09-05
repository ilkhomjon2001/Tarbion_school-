"use client";

/**
 * Murojaatlar (OTA-07, MUR-01…MUR-06) — BAZADAN.
 *
 * Ilgari bu sahifa mock roʻyxat ustida ishlar va yozilgan murojaat sahifa
 * yangilanishi bilan yoʻqolardi. Endi murojaat `appeals` jadvaliga
 * tushadi va aynan shu yozuvni administrator ham, rahbariyat ham koʻradi.
 *
 * Ota-ona nimani koʻrishini SERVER hal qiladi: bu yerda `parentName`
 * boʻyicha filtr yoʻq, chunki bunday filtr himoya emas edi — URL'ni
 * oʻzgartirgan odam baribir boshqa oilaning yozishmasini olardi.
 * Tekshiruv `appeals_service._scope()` da, soʻrov darajasida.
 */

import { LiveAppeals } from "@/components/shared/LiveAppeals";
import { ParentShell } from "@/components/parent/ParentShell";
import { useChild } from "@/lib/parent/useChild";

export default function ParentAppealsPage() {
  const [child, setChild] = useChild();

  return (
    <ParentShell title="Murojaat" child={child} onChildChange={setChild}>
      <LiveAppeals
        viewer="parent"
        title="Murojaatlar"
        hint="Ota-ona hisobingiz telefon raqami bilan kiring. Hisobingiz yoʻq boʻlsa — maktab administratoriga murojaat qiling."
      />
    </ParentShell>
  );
}
