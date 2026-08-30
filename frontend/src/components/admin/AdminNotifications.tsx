"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@/components/ui/icons";
import { useNotifications, type AdminNotification } from "@/lib/admin/store";

const TONE_CLASS: Record<AdminNotification["tone"], string> = {
  info: "bg-info-tint text-info",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  brand: "bg-brand-tint text-brand-dark",
};

/**
 * Bildirishnomalar qoʻngʻirogʻi.
 *
 * Roʻyxat alohida saqlanmaydi — joriy holatdan hisoblanadi (`useNotifications`).
 * Shu sabab ariza qabul qilinishi yoki toʻlov kiritilishi bilan son ham
 * oʻzgaradi: "koʻrildi" deb belgilash kerak emas, ish bajarilsa yoʻqoladi.
 */
export function AdminNotifications() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const total = items.reduce((sum, item) => sum + item.count, 0);

  // Tashqariga bosilganda va Escape bosilganda yopiladi.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          total > 0 ? `Bildirishnomalar — ${total} ta yangilik` : "Bildirishnomalar"
        }
        className="focus-ring relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-surface-muted"
      >
        <BellIcon className="h-5 w-5" />
        {total > 0 && (
          <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-brand-foreground">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-expand absolute right-0 top-11 z-40 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <p className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Eʼtibor talab qiladi
          </p>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-foreground-muted">
              Hamma ish bajarilgan — navbatda hech narsa yoʻq.
            </p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="focus-ring-inset flex items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface-muted/60"
                  >
                    <span
                      className={`num flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${TONE_CLASS[item.tone]}`}
                    >
                      {item.count}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="block text-xs text-foreground-muted">
                        {item.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="border-t border-border bg-surface-muted/50 px-4 py-2 text-[11px] text-foreground-muted">
            Roʻyxat joriy holatdan hisoblanadi — ish bajarilsa oʻzi yoʻqoladi.
          </p>
        </div>
      )}
    </div>
  );
}
