"use client";

import { useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { CHILDREN } from "@/lib/parent/data";
import { useChild } from "@/lib/parent/useChild";

/**
 * Xabarnoma sozlamalari (OTA-09).
 *
 * Vasiy qaysi turdagi xabarlarni olishini tanlaydi. Muhim: davomat
 * xabarini butunlay oʻchirib boʻlmaydi — maktab uchun bu majburiy
 * bildirishnoma, shuning uchun u qulflangan holda koʻrsatiladi.
 */

interface Pref {
  key: string;
  label: string;
  hint: string;
  locked?: boolean;
}

const PREFS: Pref[] = [
  {
    key: "absence",
    label: "Farzandim darsga kelmasa",
    hint: "Davomat belgilangach 30 daqiqada yuboriladi",
    locked: true,
  },
  {
    key: "daily",
    label: "Kunlik davomat xulosasi",
    hint: "Darslar tugagach bir marta",
  },
  { key: "grade", label: "Yangi baho qoʻyilganda", hint: "Har baho uchun bitta xabar" },
  { key: "homework", label: "Uy vazifasi topshirilmasa", hint: "Muddat tugagach" },
  { key: "announcement", label: "Maktab eʼlonlari", hint: "Sinf va maktab eʼlonlari" },
  { key: "payment", label: "Toʻlov eslatmasi", hint: "Muddatdan 3 kun oldin" },
  { key: "appeal", label: "Murojaatimga javob kelganda", hint: "Darhol" },
];

export default function ParentSettingsPage() {
  const [child, setChild] = useChild();
  const [on, setOn] = useState<Record<string, boolean>>({
    absence: true,
    daily: true,
    grade: true,
    homework: true,
    announcement: true,
    payment: true,
    appeal: true,
  });
  const [saved, setSaved] = useState(false);

  function toggle(key: string, locked?: boolean) {
    if (locked) return;
    setOn((p) => ({ ...p, [key]: !p[key] }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ParentShell title="Sozlamalar" child={child} onChildChange={setChild}>
      {/* Telegram holati */}
      <div className="mb-5 rounded-xl border border-success/30 bg-success-tint p-4">
        <p className="font-medium text-success">Telegram ulangan</p>
        <p className="mt-1 text-sm text-success/85">
          Xabarlar +998 90 123 45 67 raqamiga bogʻlangan Telegram hisobiga
          yuboriladi. Uzish uchun botda <code>/uzish</code> buyrugʻini yuboring.
        </p>
      </div>

      {/* Farzandlar */}
      <section className="mb-5">
        <h2 className="mb-2.5 text-sm font-semibold">Farzandlarim</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {CHILDREN.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-dark"
              >
                {c.shortName.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.fullName}</span>
                <span className="block text-sm text-foreground-muted">
                  {c.className} · {c.relation}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Xabarnomalar */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Qanday xabarlarni olaman</h2>
          {saved && (
            <span role="status" className="text-sm text-success">
              Saqlandi
            </span>
          )}
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {PREFS.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{p.label}</span>
                <span className="block text-sm text-foreground-muted">{p.hint}</span>
                {p.locked && (
                  <span className="mt-1 inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground-muted">
                    Oʻchirib boʻlmaydi — maktab qoidasi
                  </span>
                )}
              </span>

              <button
                type="button"
                role="switch"
                aria-checked={on[p.key]}
                aria-label={p.label}
                disabled={p.locked}
                onClick={() => toggle(p.key, p.locked)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${
                  on[p.key] ? "bg-brand" : "bg-surface-muted"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition-all ${
                    on[p.key] ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-2.5 text-xs text-foreground-muted">
          Xabarlar Telegram orqali keladi. Bir turdagi xabar kuniga bir marta
          jamlanadi — telefoningiz bir xil bildirishnoma bilan toʻlib ketmaydi.
        </p>
      </section>
    </ParentShell>
  );
}
