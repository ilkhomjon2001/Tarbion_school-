"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "@/components/ui/icons";

/**
 * Rahbariyat boʻlimi xatolik chegarasi — sidebar va topbar joyida qoladi,
 * faqat kontent maydoni almashadi. Shuning uchun global chegaradan koʻra
 * kamroq "portlagan" koʻrinadi.
 */
export default function DirectorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-4 md:p-6">
      <div className="animate-enter rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <AlertTriangleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">
              Boʻlimni yuklab boʻlmadi
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Maʼlumotni olishda xatolik yuz berdi. Qayta urinib koʻring — muammo
              takrorlansa, administratorga xabar bering.
            </p>
            {error.digest && (
              <p className="num mt-3 inline-block rounded-lg bg-surface-muted px-3 py-1.5 text-xs text-foreground-muted">
                Xato kodi: {error.digest}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
              >
                Qayta urinib koʻrish
              </button>
              <Link
                href="/rahbar"
                className="focus-ring rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                Bosh sahifaga qaytish
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
