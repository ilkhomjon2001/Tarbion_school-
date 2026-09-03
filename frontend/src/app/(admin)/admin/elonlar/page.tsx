"use client";

/**
 * Eʼlonlar (ADM-12) va avtomatik xabar shablonlari (T-019, BOT-05).
 *
 * Ikkalasi bir sahifada, chunki ikkalasi ham «maktab ota-onaga nima
 * yozadi» degan savolga tegishli va bir xil huquq talab qiladi
 * (`announcements.publish`). Alohida boʻlim ochilsa, shablonlar
 * kimningdir esidan chiqib, sukut matnda qolib ketardi.
 */

import { useState } from "react";

import { MessageTemplates } from "@/components/admin/MessageTemplates";
import { AnnouncementsManager } from "@/components/shared/AnnouncementsManager";

type Tab = "elon" | "shablon";

const TABS: { id: Tab; label: string }[] = [
  { id: "elon", label: "Eʼlonlar" },
  { id: "shablon", label: "Xabar shablonlari" },
];

export default function AdminAnnouncementsPage() {
  const [tab, setTab] = useState<Tab>("elon");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg bg-surface-muted p-1 mx-4 mt-4 md:mx-6" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`h-9 flex-1 rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              tab === t.id
                ? "bg-surface text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "elon" ? (
        <AnnouncementsManager />
      ) : (
        <div className="px-4 pb-6 md:px-6">
          <MessageTemplates />
        </div>
      )}
    </div>
  );
}
