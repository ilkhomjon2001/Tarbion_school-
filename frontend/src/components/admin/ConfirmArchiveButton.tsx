"use client";

import { useState } from "react";

/**
 * Ikki bosqichli arxivlash tugmasi.
 *
 * Arxivlash qaytmas amal boʻlmasa ham, roʻyxatdan darhol yoʻqotadi —
 * bitta notoʻgʻri bosish bilan xodim yoki sinf «gʻoyib boʻlishi»
 * chalkashlik tugʻdiradi. Shuning uchun birinchi bosishda savol
 * chiqadi, ikkinchisida bajariladi (StudentCard'dagi namuna bilan
 * bir xil yondashuv).
 */
export function ConfirmArchiveButton({
  onConfirm,
  disabled = false,
  label = "Arxivlash",
  question = "Rostdan arxivlansinmi?",
  className = "",
}: {
  onConfirm: () => void;
  disabled?: boolean;
  /** Birinchi bosqichdagi tugma matni. */
  label?: string;
  /** Ikkinchi bosqichdagi savol matni. */
  question?: string;
  /** Birinchi bosqich tugmasiga qoʻshimcha klasslar. */
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setConfirming(true)}
        className={
          className ||
          "focus-ring rounded px-2 py-1 text-xs font-medium text-danger hover:underline disabled:opacity-50"
        }
      >
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-foreground-muted">{question}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        className="focus-ring rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        Ha, arxivlash
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="focus-ring rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground-muted"
      >
        Bekor
      </button>
    </span>
  );
}
