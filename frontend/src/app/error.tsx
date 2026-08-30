"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "@/components/ui/icons";
import { hardReload, isStaleBundleError } from "@/lib/errors";

/**
 * Global xatolik chegarasi. Busiz server komponentidagi har qanday xato
 * Next.js ning oʻz ekranini koʻrsatadi — oʻzbekcha emas va "qayta urinish"
 * tugmasi yoʻq.
 *
 * Backend ulanganda `console.error` oʻrniga xatoni kuzatuv xizmatiga
 * yuborish kerak (Sentry va h.k.).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleBundleError(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="animate-enter w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-tint text-danger">
          <AlertTriangleIcon className="h-6 w-6" />
        </span>
        <h1 className="text-h3 font-semibold text-foreground">
          {stale ? "Ilova yangilandi" : "Xatolik yuz berdi"}
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          {stale
            ? "Sahifa eski nusxada ochilib qolgan. Sahifani yangilang — barcha maʼlumot joyida."
            : "Sahifani yuklab boʻlmadi. Qayta urinib koʻring — muammo takrorlansa, administratorga xabar bering."}
        </p>

        {error.digest && !stale && (
          <p className="num mt-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
            Xato kodi: {error.digest}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={stale ? hardReload : reset}
            className="focus-ring rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            {stale ? "Sahifani yangilash" : "Qayta urinib koʻrish"}
          </button>
          <Link
            href="/"
            className="focus-ring rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}
