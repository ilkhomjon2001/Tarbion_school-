"use client";

/**
 * Hisobotni Excel qilib yuklab olish (DIR-08).
 *
 * Fayl BRAUZERDA yasalmaydi — serverdan olinadi. Sabab X-13: har bir
 * eksport audit jurnaliga tushishi shart, brauzerda CSV yigʻish esa
 * bu izni butunlay chetlab oʻtardi.
 *
 * Huquq ham serverda: `reports.export` yoʻq boʻlsa `403` keladi va
 * tugma xato matnini koʻrsatadi. Tugmani oldindan yashirmaymiz —
 * huquq roʻyxati bu sahifada yoʻq va yashirish himoya ham emas.
 */

import { useState } from "react";

import { getToken } from "@/lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const btnClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";

export type ReportKind = "sinflar" | "ustozlar" | "qarzdorlik";

const LABEL: Record<ReportKind, string> = {
  sinflar: "Sinflar kesimi",
  ustozlar: "Ustozlar faoliyati",
  qarzdorlik: "Toʻlov va qarzdorlik",
};

export function ReportExport({ kinds }: { kinds: ReportKind[] }) {
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  async function yuklab(kind: ReportKind) {
    setBusy(kind);
    setXato(null);
    try {
      const r = await fetch(`${API_BASE}/api/v1/director/reports/${kind}/export`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (r.status === 403) {
        setXato(
          "Yuklab olish huquqingiz yoʻq. Administrator «Hisobotlarni eksport» huquqini beradi.",
        );
        return;
      }
      if (!r.ok) {
        setXato("Hisobotni yuklab boʻlmadi. Qayta urinib koʻring.");
        return;
      }

      // Fayl nomi serverdan keladi — unda sana bor va u fayl
      // qoʻldan qoʻlga oʻtganda ham saqlanib qoladi.
      const disposition = r.headers.get("content-disposition") ?? "";
      const nom =
        /filename="([^"]+)"/.exec(disposition)?.[1] ?? `tarbion-${kind}.xlsx`;

      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nom;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setXato("Hisobotni yuklab boʻlmadi. Internetni tekshiring.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            disabled={busy !== null}
            onClick={() => void yuklab(k)}
            className={btnClass}
          >
            ⬇ {busy === k ? "Yuklanmoqda…" : `${LABEL[k]} — Excel`}
          </button>
        ))}
      </div>

      {xato && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}

      <p className="text-xs text-foreground-muted">
        Har bir yuklab olish audit jurnaliga tushadi: kim, qachon, qaysi
        roʻyxatni olgani yozib qoʻyiladi. PDF uchun sahifani brauzerdan chop
        eting (Ctrl+P → «PDF sifatida saqlash»).
      </p>
    </div>
  );
}
