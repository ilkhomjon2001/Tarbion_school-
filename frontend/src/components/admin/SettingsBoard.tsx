"use client";

import { useState } from "react";
import { AccessCenter } from "@/components/admin/AccessCenter";
import { StaffBoard } from "@/components/admin/StaffBoard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SettingsIcon } from "@/components/ui/icons";

type Tab = "staff" | "users" | "school";

const TABS: { id: Tab; label: string }[] = [
  { id: "staff", label: "Xodimlar" },
  { id: "users", label: "Kirish huquqlari" },
  { id: "school", label: "Maktab" },
];

/**
 * Sozlamalar — faqat super administrator uchun.
 *
 * «Xodimlar» va «Kirish huquqlari» HAQIQIY API bilan ishlaydi (T-005).
 * «Maktab» bandi (nom, toʻlov qoidalari) hali serverda yoʻq — demo
 * forma oʻrniga halol boʻsh holat. Boʻlim yashirish HIMOYA EMAS —
 * har bir endpoint huquqni serverda tekshiradi (CLAUDE.md 7-qoida).
 */
export function SettingsBoard() {
  const [tab, setTab] = useState<Tab>("staff");

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-bold text-foreground">Sozlamalar</h1>
        <p className="text-sm text-foreground-muted">
          Xodim hisoblari, kirish huquqlari va maktabning umumiy parametrlari
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Sozlamalar boʻlimlari"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-brand text-brand-dark"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "staff" && <StaffBoard />}
      {tab === "users" && <AccessCenter />}
      {tab === "school" && (
        <EmptyState
          icon={<SettingsIcon className="h-5 w-5" />}
          title="Bu boʻlim serverga hali ulanmagan"
          description="Maktab nomi, toʻlov qoidalari va boshqa umumiy parametrlar keyingi bosqichda serverda saqlanadi. Hozircha oʻquv yili va qoʻngʻiroqlar jadvali «Maʼlumot bazasi» boʻlimida yuritiladi."
        />
      )}

      <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
        Boʻlimni yashirish — qulaylik, himoya emas. Haqiqiy tekshiruv serverda:
        yashiringan boʻlim manzilini qoʻlda yozgan odam ham maʼlumotni ololmaydi.
      </p>
    </div>
  );
}
