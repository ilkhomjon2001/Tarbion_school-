"use client";

import { ParentShell } from "@/components/parent/ParentShell";
import { useChildren } from "@/lib/parent/useChild";

/**
 * Oshxona menyusi — FAQAT ota-ona kabinetida (loyiha egasi qarori:
 * ovqatni ota-ona tanlaydi va toʻlaydi, oʻquvchiga koʻrsatish shart emas).
 *
 * Avval bu yerda kodga yozib qoʻyilgan statik menyu turardi — u
 * haqiqiy oshxona menyusi emas edi va eskirib yolgʻonga aylanardi
 * (audit O29). Menyuni kiritish backend'i yozilgunga qadar halol
 * "hali kiritilmagan" holati koʻrsatiladi.
 */
export default function ParentCafeteriaPage() {
  const { child, children: farzandlar, select, loading, error } = useChildren();

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-5 sm:px-6" aria-busy="true">
        <div className="mb-5 h-7 w-48 animate-pulse rounded-lg bg-surface-muted" />
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
      title="Oshxona menyusi"
      child={child}
      siblings={farzandlar}
      onChildChange={select}
    >
      <div className="rounded-xl border border-border bg-surface px-5 py-10 text-center">
        <p className="font-medium">Haftalik menyu hali kiritilmagan</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-foreground-muted">
          Oshxona menyusi maktab tomonidan kiritilgach shu yerda haftalik
          koʻrinishda chiqadi. Savollar boʻlsa maktab administratsiyasiga
          murojaat qiling.
        </p>
      </div>
    </ParentShell>
  );
}
