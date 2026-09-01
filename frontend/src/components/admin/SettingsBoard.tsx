"use client";

import { useEffect, useState } from "react";
import { AccessCenter } from "@/components/admin/AccessCenter";
import { StaffBoard } from "@/components/admin/StaffBoard";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  schoolSchoolSettings,
  schoolSetSchoolSettings,
} from "@/lib/api/sdk.gen";
import type { SchoolSettingsOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

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
      {tab === "school" && <SchoolTab />}

      <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">
        Boʻlimni yashirish — qulaylik, himoya emas. Haqiqiy tekshiruv serverda:
        yashiringan boʻlim manzilini qoʻlda yozgan odam ham maʼlumotni ololmaydi.
      </p>
    </div>
  );
}


// ─────────────────────────── Maktab rekvizitlari ───────────────────────────

/**
 * Maktab nomi, manzili, telefoni va direktor ismi — BAZADAN.
 * Kvitansiya sarlavhasi va hujjat shablonlari shu maʼlumotdan oladi.
 * Yozish `users.manage` huquqi bilan (server tekshiradi).
 */
function SchoolTab() {
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    director_name: "",
  });
  const [yuklandi, setYuklandi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [xabar, setXabar] = useState<{ tur: "ok" | "xato"; matn: string } | null>(null);

  useEffect(() => {
    let alive = true;
    withAuth<SchoolSettingsOut>(() => schoolSchoolSettings())
      .then((r) => {
        if (!alive) return;
        setForm({
          name: r.name,
          address: r.address,
          phone: r.phone,
          director_name: r.director_name,
        });
        setYuklandi(true);
      })
      .catch(() => alive && setXabar({ tur: "xato", matn: "Maʼlumotni olib boʻlmadi." }));
    return () => {
      alive = false;
    };
  }, []);

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !form.name.trim()) return;
    setBusy(true);
    setXabar(null);
    try {
      await withAuth<SchoolSettingsOut>(() =>
        schoolSetSchoolSettings({ body: form }),
      );
      setXabar({ tur: "ok", matn: "Rekvizitlar saqlandi." });
    } catch {
      setXabar({
        tur: "xato",
        matn: "Saqlab boʻlmadi. Huquqingizni tekshirib, qayta urining.",
      });
    } finally {
      setBusy(false);
    }
  }

  const input =
    "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";

  return (
    <form onSubmit={saqla} className="flex max-w-xl flex-col gap-3">
      <p className="text-sm text-foreground-muted">
        Bu rekvizitlar toʻlov kvitansiyasi va hujjatlarda ishlatiladi.
      </p>

      {xabar && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            xabar.tur === "ok"
              ? "bg-success-tint text-success"
              : "bg-danger-tint text-danger"
          }`}
        >
          {xabar.matn}
        </p>
      )}

      {!yuklandi && xabar === null ? (
        <ListSkeleton count={4} />
      ) : (
        <>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Maktab nomi
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Manzil</span>
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className={input}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">
                Telefon
              </span>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">
                Direktor F.I.Sh.
              </span>
              <input
                value={form.director_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, director_name: e.target.value }))
                }
                className={input}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !form.name.trim()}
              className="focus-ring inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "Saqlanmoqda…" : "Oʻzgarishlarni saqlash"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
