"use client";

import { ParentShell } from "@/components/parent/ParentShell";
import { MenuDayTabs } from "@/components/shared/MenuDayTabs";
import { useChild } from "@/lib/parent/useChild";
import { weeklyMenu } from "@/lib/school/menu";

/**
 * Oshxona menyusi — FAQAT ota-ona kabinetida (loyiha egasi qarori:
 * ovqatni ota-ona tanlaydi va toʻlaydi, oʻquvchiga koʻrsatish shart emas).
 *
 * TZ 10-boʻlimi boʻyicha oshxona moduli shartnoma doirasidan tashqarida —
 * docs/DECISIONS.md ga qara.
 */
export default function ParentCafeteriaPage() {
  const [child, setChild] = useChild();

  return (
    <ParentShell title="Oshxona menyusi" child={child} onChildChange={setChild}>
      <p className="mb-4 text-sm text-foreground-muted">
        Kuniga 3 mahal ovqat beriladi: nonushta, tushlik va kechki yengil taom.
        Menyu har kuni har xil boʻladi.
      </p>
      <MenuDayTabs days={weeklyMenu} />
    </ParentShell>
  );
}
