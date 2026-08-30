"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "@/components/ui/icons";
import { hardReload, isStaleBundleError } from "@/lib/errors";

/** Admin boʻlimi xatolik chegarasi — sidebar joyida qoladi. */
export default function AdminError({
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
    <div className="p-4 md:p-6">
      <div className="animate-enter rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <AlertTriangleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">
              {stale ? "Ilova yangilandi" : "Boʻlimni yuklab boʻlmadi"}
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {stale
                ? "Sahifa eski nusxada ochilib qolgan. Sahifani yangilang — barcha maʼlumot joyida."
                : "Maʼlumotni olishda xatolik yuz berdi. Qayta urinib koʻring — muammo takrorlansa, administratorga xabar bering."}
            </p>
            {error.digest && !stale && (
              <p className="num mt-3 inline-block rounded-lg bg-surface-muted px-3 py-1.5 text-xs text-foreground-muted">
                Xato kodi: {error.digest}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={stale ? hardReload : reset}
                className="focus-ring rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
              >
                {stale ? "Sahifani yangilash" : "Qayta urinib koʻrish"}
              </button>
              <Link
                href="/admin"
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
