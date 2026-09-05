"use client";

/**
 * Metodik bazada qidiruv (MET-05).
 *
 * TZ uchta manbani nomlaydi: mavzu nomi, atama va jihoz nomi.
 * Server har natijada `matched_in` qaytaradi va u KOʻRSATILADI —
 * foydalanuvchi «nega bu chiqdi?» degan savolga javob koʻrsin,
 * ayniqsa jihoz boʻyicha topilganda mavzu nomi soʻzni umuman
 * oʻz ichiga olmaydi.
 *
 * Qidiruv faqat JORIY rejalar boʻyicha — qoralama hali hujjat emas.
 * Bu qoida serverda.
 */

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SearchIcon } from "@/components/ui/icons";
import { searchCurriculum, type SearchHitOut } from "@/lib/curriculum/data";

const CHORAKLAR = [1, 2, 3, 4];

const MATCH_LABEL: Record<string, string> = {
  mavzu: "mavzu nomi",
  atama: "atama",
  jihoz: "jihoz",
};

const inputClass =
  "focus-ring h-9 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none";

export function CurriculumSearch({
  onOpen,
}: {
  /** Natija bosilganda — fan/yil/sinf ga oʻtish. */
  onOpen?: (hit: SearchHitOut) => void;
}) {
  const [q, setQ] = useState("");
  const [chorak, setChorak] = useState<number | "">("");
  const [rows, setRows] = useState<SearchHitOut[] | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const qidir = useCallback(async () => {
    const soz = q.trim();
    if (soz.length < 2) {
      setRows(null);
      return;
    }
    setBusy(true);
    setXato(null);
    try {
      setRows(
        await searchCurriculum({
          q: soz,
          ...(chorak === "" ? {} : { chorak }),
        }),
      );
    } catch (err) {
      setXato(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Qidirib boʻlmadi.",
      );
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [q, chorak]);

  // Yozayotganda har harfga soʻrov ketmasin — 350 ms kutiladi.
  useEffect(() => {
    const t = setTimeout(() => void qidir(), 350);
    return () => clearTimeout(t);
  }, [qidir]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1">
          <span className="mb-1.5 block text-xs font-medium text-foreground">
            Qidiruv
          </span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Mavzu, atama yoki jihoz nomi"
              className={`${inputClass} w-full pl-8`}
            />
          </div>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Chorak</span>
          <select
            value={chorak}
            onChange={(e) => setChorak(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputClass}
          >
            <option value="">Hammasi</option>
            {CHORAKLAR.map((c) => (
              <option key={c} value={c}>
                {c}-chorak
              </option>
            ))}
          </select>
        </label>
      </div>

      {xato && <ErrorState description={xato} />}

      {q.trim().length >= 2 && !busy && rows !== null && rows.length === 0 && !xato && (
        <EmptyState
          icon={<SearchIcon className="h-5 w-5" />}
          title="Hech narsa topilmadi"
          description="Qidiruv joriy qilingan rejalar boʻyicha ishlaydi. Atama yoki jihoz nomining bir qismini yozib koʻring."
        />
      )}

      {rows !== null && rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((h) => (
            <li key={`${h.plan_id}-${h.index}`}>
              <button
                type="button"
                onClick={() => onOpen?.(h)}
                disabled={!onOpen}
                className="focus-ring flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-muted disabled:cursor-default disabled:hover:bg-surface"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {h.title}
                  </span>
                  <span className="block text-xs text-foreground-muted">
                    {h.fan} · {h.sinf} · {h.chorak}-chorak
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-xs text-foreground-muted">
                  {MATCH_LABEL[h.matched_in] ?? h.matched_in} boʻyicha
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
