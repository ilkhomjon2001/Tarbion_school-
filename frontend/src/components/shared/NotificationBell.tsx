"use client";

/**
 * Bildirishnoma qoʻngʻirogʻi — barcha kabinetlar uchun bitta komponent.
 *
 * Har kabinetga alohida yozilmadi: bu oltita joyda oltita «oʻqilgan deb
 * belgilash» mantigʻi degani boʻlardi va biri kechroq unutilardi. Rol
 * boʻyicha farq yoʻq — server allaqachon faqat oʻz bildirishnomangni
 * yuboradi.
 *
 * «Oʻqildi» belgisi bosilganda qoʻyiladi, ochilganda emas: qoʻngʻiroqni
 * ochib yopgan odam xabarni oʻqigan hisoblanmaydi.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BellIcon } from "@/components/ui/icons";
import {
  NOTIFICATION_KIND_LABELS,
  type NotificationKind,
} from "@/lib/contracts";
import { useNotifications } from "@/lib/notifications/use-notifications";
import type { NotificationOut } from "@/lib/notifications/api";

/** Turkum rangi — matnni oʻqimasdan ham nima boʻlganini bildiradi. */
const TONE: Record<NotificationKind, string> = {
  attendance_absent: "bg-danger-tint text-danger",
  attendance_late: "bg-warning-tint text-warning",
  appeal_new: "bg-brand-tint text-brand-dark",
  appeal_message: "bg-info-tint text-info",
  appeal_assigned: "bg-info-tint text-info",
  appeal_closed: "bg-surface-muted text-foreground-muted",
};

export function NotificationBell({ className = "" }: { className?: string }) {
  const { items, total, loading, error, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          total > 0 ? `Bildirishnomalar — ${total} ta oʻqilmagan` : "Bildirishnomalar"
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
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Bildirishnomalar</p>
            {total > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="focus-ring rounded text-xs font-medium text-brand transition-colors hover:text-brand-dark"
              >
                Hammasini oʻqilgan deb belgilash
              </button>
            )}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-foreground-muted">
                Yuklanmoqda…
              </p>
            ) : error ? (
              <p role="alert" className="px-4 py-6 text-center text-sm text-danger">
                {error}
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-foreground-muted">
                Hozircha bildirishnoma yoʻq.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      setOpen(false);
                      if (item.read_at === null) void markRead([item.id]);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ item, onOpen }: { item: NotificationOut; onOpen: () => void }) {
  const unread = item.read_at === null;

  return (
    <li>
      <Link
        href={item.link}
        onClick={onOpen}
        className={`focus-ring flex gap-3 px-4 py-3 transition-colors hover:bg-surface-muted ${
          unread ? "bg-brand-tint/30" : ""
        }`}
      >
        {/* Oʻqilmaganning chap chetida nuqta — rang koʻrmaydiganlar
            uchun ham holat koʻrinib tursin. */}
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            unread ? "bg-brand" : "bg-transparent"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                TONE[item.kind as NotificationKind] ?? "bg-surface-muted text-foreground-muted"
              }`}
            >
              {NOTIFICATION_KIND_LABELS[item.kind as NotificationKind] ?? item.kind_label}
            </span>
            <span className="num text-[11px] text-foreground-muted">
              {formatMoment(item.created_at)}
            </span>
          </span>
          <span className="mt-1 block truncate text-sm font-medium text-foreground">
            {item.title}
          </span>
          <span className="mt-0.5 block line-clamp-2 text-xs text-foreground-muted">
            {item.body}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Vaqt Asia/Tashkent da koʻrsatiladi (CLAUDE.md 3-qoida).
 *
 * Brauzer zonasiga tashlab qoʻyish notoʻgʻri boʻlardi: chet eldagi
 * ota-ona farzandi qaysi soatda darsga kelmaganini notoʻgʻri koʻrardi.
 */
const TIME_FORMAT = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_FORMAT = new Intl.DateTimeFormat("uz-UZ", {
  timeZone: "Asia/Tashkent",
  day: "2-digit",
  month: "2-digit",
});

function formatMoment(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";

  // Bugungi xabarda sana ortiqcha — soat yetarli va roʻyxat tozaroq.
  const bugun = new Date();
  const sameDay =
    DAY_FORMAT.format(at) === DAY_FORMAT.format(bugun) &&
    at.getFullYear() === bugun.getFullYear();

  return sameDay ? TIME_FORMAT.format(at) : DAY_FORMAT.format(at);
}
