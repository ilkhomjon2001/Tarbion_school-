"use client";

import { useState } from "react";

/**
 * Vazifa topshirish formasi (UYV-02).
 *
 * Fayl biriktirish YOʻQ: fayllar R2 orqali yuklanadi (T-025) va u modul
 * hali yozilmagan — ishlamaydigan tugma koʻrsatilmaydi.
 */
export function HomeworkSubmitForm({
  onSubmit,
}: {
  /** Serverga yuboradi; xato boʻlsa throw qiladi. */
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        setError("");
        onSubmit(text.trim())
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Topshirib boʻlmadi.");
          })
          .finally(() => setBusy(false));
      }}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <div>
        <label
          htmlFor="homework-answer"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Javob matni
        </label>
        <textarea
          id="homework-answer"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          placeholder="Bajarilgan vazifa haqida yozing..."
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={text.trim().length === 0 || busy}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Topshirilmoqda…" : "Topshirish"}
      </button>
    </form>
  );
}
