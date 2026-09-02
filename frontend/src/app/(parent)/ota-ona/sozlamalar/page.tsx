"use client";

import { ParentShell } from "@/components/parent/ParentShell";
import { TelegramLink } from "@/components/parent/TelegramLink";
import { useChildren } from "@/lib/parent/useChild";

/**
 * Sozlamalar (OTA-09).
 *
 * Avval bu sahifa mock edi: begona ismli farzandlar roʻyxati, soxta
 * "Telegram ulangan" holati va hech qayerga saqlanmaydigan bildirishnoma
 * tugmalari (audit K8). Endi faqat HAQIQIY narsalar koʻrsatiladi:
 * farzandlar backenddan, Telegram esa haqiqiy bogʻlanish (T-017):
 * kod shu yerdan olinadi, telefon botda tasdiqlanadi.
 */
export default function ParentSettingsPage() {
  const { child, children: farzandlar, select, loading, error } = useChildren();

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-5 sm:px-6" aria-busy="true">
        <div className="mb-5 h-7 w-40 animate-pulse rounded-lg bg-surface-muted" />
        <div className="mb-5 h-20 animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="font-medium">{error ?? "Sizga farzand biriktirilmagan"}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Maktab administratoriga murojaat qiling.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ParentShell
      title="Sozlamalar"
      child={child}
      siblings={farzandlar}
      onChildChange={select}
    >
      {/* Telegramga ulash (T-017). Bot sozlanmagan boʻlsa komponentning
          oʻzi «hali ishga tushirilmagan» deb koʻrsatadi. */}
      <TelegramLink />

      {/* Farzandlar — BAZADAN */}
      <section className="mb-5">
        <h2 className="mb-2.5 text-sm font-semibold">Farzandlarim</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {farzandlar.map((c) => (
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
        <p className="mt-2.5 text-xs text-foreground-muted">
          Roʻyxatda xatolik boʻlsa, maktab administratsiyasiga murojaat
          qiling.
        </p>
      </section>

      {/* Bildirishnoma sozlamalari — bot bilan birga keladi */}
      <section>
        <h2 className="mb-2.5 text-sm font-semibold">Bildirishnoma sozlamalari</h2>
        <div className="rounded-xl border border-border bg-surface px-4 py-6 text-center">
          <p className="font-medium">Bu boʻlim tayyorlanmoqda</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Qaysi xabarlarni olishni Telegram-bot ishga tushgach shu yerdan
            tanlaysiz.
          </p>
        </div>
      </section>
    </ParentShell>
  );
}
