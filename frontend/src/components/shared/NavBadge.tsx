"use client";

/**
 * Yon menyudagi oʻqilmagan xabarlar soni.
 *
 * Boʻlim kaliti — menyudagi `href` ning oʻzi (`core/sections.py` dagi
 * boʻlim id si). Shu sabab menyuga yangi band qoʻshilganda bu yerda
 * hech narsa yozilmaydi: son avtomatik paydo boʻladi.
 */

import { useSectionBadges } from "@/lib/notifications/use-notifications";

export function NavBadge({
  section,
  /**
   * Pastki mobil menyu uchun: band ustunga tizilgan va yonida joy yoʻq,
   * shuning uchun son belgichaning ustiga suzib turadi. Joylashuvi
   * ota-elementga bogʻliq — u `relative` boʻlishi kerak.
   */
  floating = false,
}: {
  section: string;
  floating?: boolean;
}) {
  const badges = useSectionBadges();
  const count = badges[section] ?? 0;

  if (count === 0) return null;

  const base =
    "num flex items-center justify-center rounded-full bg-danger font-semibold text-brand-foreground";

  return (
    <span
      className={
        floating
          ? `${base} absolute right-3 top-1 h-4 min-w-4 px-1 text-[10px]`
          : `${base} ml-auto h-5 min-w-5 shrink-0 px-1.5 text-[11px]`
      }
      aria-label={`${count} ta oʻqilmagan`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
