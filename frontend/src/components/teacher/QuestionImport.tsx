"use client";

/**
 * Savollarni Excelʼdan ommaviy import (TST-06).
 *
 * Ikki qadam: shablonni yuklab olish → toʻldirib qaytarish. Savol
 * turi shablonda YOʻQ — u toʻgʻri javoblar sonidan kelib chiqadi,
 * shuning uchun «multiple deb yozib bitta javob belgilash» xatosi
 * umuman chiqmaydi.
 *
 * Ogohlantirishlar KOʻRSATILADI. Buzuq qator importni toʻxtatmaydi
 * va jimgina tashlanadi — agar bu koʻrinmasa, ustoz 60 ta savoldan
 * 57 tasi kirganini bilmay qoladi.
 */

import { useState } from "react";

import {
  downloadQuestionTemplate,
  importQuestions,
  type QuestionImportOut,
} from "@/lib/teacher/tests-api";

const btnClass =
  "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";

export function QuestionImport({
  testId,
  disabled,
  onImported,
}: {
  testId: string;
  /** Eʼlon qilingan testga import qilinmaydi — serverda ham shunday. */
  disabled: boolean;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [natija, setNatija] = useState<QuestionImportOut | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  async function yukla(file: File) {
    setBusy(true);
    setXato(null);
    setNatija(null);
    try {
      setNatija(await importQuestions(testId, file));
      onImported();
    } catch (err) {
      setXato(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Faylni yuklab boʻlmadi.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return null;

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-foreground">
        Savollarni Excelʼdan yuklash
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void downloadQuestionTemplate().catch(() => setXato("Shablonni yuklab boʻlmadi."))}
          className={btnClass}
        >
          ⬇ Shablonni yuklab olish
        </button>

        <label className={`${btnClass} cursor-pointer`}>
          {busy ? "Yuklanmoqda…" : "⬆ Toʻldirilgan faylni yuklash"}
          <input
            type="file"
            accept=".xlsx"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Bir xil faylni qayta tanlash ham hodisa bersin.
              e.target.value = "";
              if (f) void yukla(f);
            }}
            className="sr-only"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-foreground-muted">
        Toʻgʻri variant «+» bilan boshlanadi. Savol turi avtomatik:
        bitta toʻgʻri javob — «Bitta javob», bir nechtasi — «Bir nechta
        javob». Savollar mavjudlariga qoʻshiladi.
      </p>

      {xato && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {xato}
        </p>
      )}

      {natija && (
        <div className="mt-2 rounded-lg bg-success-tint px-3 py-2 text-sm text-success">
          <p className="font-medium">{natija.added} ta savol qoʻshildi.</p>
          {natija.warnings.length > 0 && (
            <>
              <p className="mt-1 text-warning">
                {natija.warnings.length} ta qator tashlab yuborildi:
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs text-warning">
                {natija.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
