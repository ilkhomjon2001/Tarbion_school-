"use client";

/**
 * Bildirishnomalar — backend bilan ishlash qatlami va umumiy holat.
 *
 * Nima uchun oddiy `useEffect` emas
 * ---------------------------------
 * Bildirishnomani bir vaqtda IKKI joy koʻrsatadi: yuqoridagi qoʻngʻiroq
 * va yon menyudagi sanoq. Har biri oʻzi soʻrov yuborsa, ikki barobar
 * trafik boʻlardi va bittasi oʻqilgandan keyin ikkinchisi eski sonni
 * koʻrsatib turardi.
 *
 * Shuning uchun holat modul darajasida bitta: kim ochilsa oʻshanga
 * obuna boʻladi, soʻrov esa bitta. Oxirgi obunachi ketganda soʻrov
 * ham toʻxtaydi.
 *
 * Kirish nazorati BU YERDA EMAS. Kim nimani koʻrishini server hal
 * qiladi — har bir soʻrov `WHERE user_id = :men` bilan cheklangan
 * (CLAUDE.md 7-qoida).
 */

import {
  notificationsBadges,
  notificationsListNotifications,
  notificationsMarkAllRead,
  notificationsMarkRead,
} from "@/lib/api/sdk.gen";
import type { BadgeOut, NotificationOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { NotificationOut };

/**
 * Qayta soʻrash oraligʻi. 45 soniya — ustoz davomatni belgilagach
 * ota-ona deyarli darhol koʻradi, lekin server 25 kishilik maktabdan
 * soniyada bir necha soʻrov olmaydi.
 */
const POLL_MS = 45_000;

// ─────────────────────────── Soʻrovlar ───────────────────────────

export async function fetchNotifications(
  options: { onlyUnread?: boolean; section?: string; limit?: number } = {},
): Promise<NotificationOut[]> {
  return withAuth<NotificationOut[]>(() =>
    notificationsListNotifications({
      query: {
        only_unread: options.onlyUnread ?? false,
        section: options.section,
        limit: options.limit ?? 30,
      },
    }),
  );
}

export async function fetchBadges(): Promise<BadgeOut> {
  return withAuth<BadgeOut>(() => notificationsBadges());
}

export async function markRead(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const out = await withAuth<{ updated: number }>(() =>
    notificationsMarkRead({ body: { ids } }),
  );
  return out.updated;
}

export async function markAllRead(section?: string): Promise<number> {
  const out = await withAuth<{ updated: number }>(() =>
    notificationsMarkAllRead({ body: { section: section ?? null } }),
  );
  return out.updated;
}

// ─────────────────────── Umumiy holat (store) ───────────────────────

export interface NotificationState {
  items: NotificationOut[];
  /** Boʻlim id → oʻqilmaganlar soni. Nol boʻlgan boʻlim bu yerda yoʻq. */
  sections: Record<string, number>;
  total: number;
  loading: boolean;
  /** Xato boʻlsa matni; interfeys jim qolmasligi uchun. */
  error: string | null;
}

const EMPTY: NotificationState = {
  items: [],
  sections: {},
  total: 0,
  loading: true,
  error: null,
};

let state: NotificationState = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

function publish(next: Partial<NotificationState>): void {
  state = { ...state, ...next };
  for (const listen of listeners) listen();
}

async function refresh(): Promise<void> {
  // Sekin tarmoqda oraliq tugab, ikkinchi soʻrov ketmasin.
  if (inFlight) return;
  inFlight = true;
  try {
    const [items, badges] = await Promise.all([fetchNotifications(), fetchBadges()]);
    publish({
      items,
      sections: badges.sections,
      total: badges.total,
      loading: false,
      error: null,
    });
  } catch (err) {
    // Sessiya tugagan boʻlishi mumkin — sanoqni nolga tushiramiz, lekin
    // sahifani buzmaymiz. Foydalanuvchini `AuthGuard` login sahifasiga
    // olib chiqadi.
    publish({
      loading: false,
      error: err instanceof Error ? err.message : "Bildirishnomalar yuklanmadi",
    });
  } finally {
    inFlight = false;
  }
}

/** Yangilashni majburan ishga tushiradi — masalan oʻqilgan deb belgilangach. */
export function reload(): void {
  void refresh();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    void refresh();
    timer = setInterval(() => void refresh(), POLL_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      // Holat saqlanadi: keyingi sahifada qoʻngʻiroq boʻsh emas, eski
      // sanoq bilan chiqadi va birinchi soʻrovdan keyin yangilanadi.
    }
  };
}

export function snapshot(): NotificationState {
  return state;
}
