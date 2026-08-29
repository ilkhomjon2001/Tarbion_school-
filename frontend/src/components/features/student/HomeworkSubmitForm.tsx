"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";

export function HomeworkSubmitForm() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-xl border border-success-tint bg-success-tint p-4 text-center">
        <p className="text-sm font-medium text-success">
          Vazifa muvaffaqiyatli topshirildi
        </p>
        <p className="mt-1 text-xs text-success/80">
          Ustoz tekshirgach, natija shu sahifada koʻrinadi.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
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

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Fayl yoki rasm (ixtiyoriy)
        </label>
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm text-foreground-muted hover:bg-surface-muted">
          <span>{fileName ?? "Fayl tanlash"}</span>
          {fileName ? <Badge tone="brand">tanlandi</Badge> : null}
          <input
            type="file"
            className="hidden"
            onChange={(event) =>
              setFileName(event.target.files?.[0]?.name ?? null)
            }
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={text.trim().length === 0}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        Topshirish
      </button>
    </form>
  );
}
