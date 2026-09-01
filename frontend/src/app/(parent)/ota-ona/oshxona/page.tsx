"use client";

/**
 * Oshxona haftalik menyusi (OTA-08) — BAZADAN.
 *
 * Menyu haftalik shablon: administrator «Maʼlumot bazasi → Oshxona»
 * boʻlimida kiritadi, bu yerda faqat koʻrsatiladi. Bugungi kun ochiq
 * holda keladi.
 */

import { useEffect, useMemo, useState } from "react";

import { ParentShell } from "@/components/parent/ParentShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useChild } from "@/lib/parent/useChild";
import { WEEKDAYS_UZ, fetchCafeteriaMenu } from "@/lib/school/api";

/** Bugungi hafta kuni — 1 (dushanba) … 7, Toshkent boʻyicha. */
function bugungiKun(): number {
  const nomi = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
  }).format(new Date());
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[nomi] ?? 1;
}

export default function CafeteriaPage() {
  const [child, selectChild] = useChild();
  const [menu, setMenu] = useState<Record<number, string[]> | null>(null);
  const [xato, setXato] = useState(false);
  const [ochiq, setOchiq] = useState<number>(bugungiKun());

  useEffect(() => {
    let alive = true;
    fetchCafeteriaMenu()
      .then((m) => alive && setMenu(m))
      .catch(() => alive && setXato(true));
    return () => {
      alive = false;
    };
  }, []);

  const kunlar = useMemo(
    () => WEEKDAYS_UZ.filter((d) => (menu?.[d.id] ?? []).length > 0),
    [menu],
  );

  return (
    <ParentShell title="Oshxona" child={child} onChildChange={selectChild}>
      <div className="flex flex-col gap-3">
        {xato && (
          <ErrorState description="Menyuni olib boʻlmadi. Sahifani yangilab koʻring." />
        )}
        {!xato && menu === null && <ListSkeleton count={5} />}
        {menu !== null && kunlar.length === 0 && (
          <EmptyState
            title="Menyu hali kiritilmagan"
            description="Haftalik taomnoma administrator tomonidan kiritilgach shu yerda koʻrinadi."
          />
        )}

        {kunlar.length > 0 && (
          <>
            <div
              role="tablist"
              aria-label="Hafta kunlari"
              className="scroll-x flex gap-1.5"
            >
              {kunlar.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={ochiq === d.id}
                  onClick={() => setOchiq(d.id)}
                  className={`focus-ring shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    ochiq === d.id
                      ? "bg-brand text-brand-foreground"
                      : "bg-surface-muted text-foreground-muted hover:bg-surface"
                  }`}
                >
                  {d.short}
                  {d.id === bugungiKun() && " · bugun"}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">
                {WEEKDAYS_UZ.find((d) => d.id === ochiq)?.long}
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {(menu?.[ochiq] ?? []).map((taom, i) => (
                  <li
                    key={`${ochiq}-${i}`}
                    className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground"
                  >
                    <span aria-hidden className="text-brand-dark">
                      •
                    </span>
                    {taom}
                  </li>
                ))}
                {(menu?.[ochiq] ?? []).length === 0 && (
                  <li className="text-sm text-foreground-muted">
                    Bu kun uchun menyu kiritilmagan.
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </ParentShell>
  );
}
