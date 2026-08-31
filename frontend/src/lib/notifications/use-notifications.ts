"use client";

/**
 * Bildirishnomalarga obuna boʻlish uchun hook.
 *
 * `useSyncExternalStore` ataylab: holat React'dan tashqarida (bir necha
 * komponent bitta soʻrovdan ishlaydi), lekin React uni toʻgʻri kuzatishi
 * kerak. `useState` + `useEffect` bilan yozilsa server render bilan
 * mos kelmay hydration ogohlantirishi chiqardi.
 */

import { useCallback, useSyncExternalStore } from "react";

import {
  markAllRead as apiMarkAllRead,
  markRead as apiMarkRead,
  reload,
  snapshot,
  subscribe,
  type NotificationState,
} from "@/lib/notifications/api";

/**
 * Server renderida bildirishnoma yoʻq: token brauzerdagi sessiyada.
 * Alohida obyekt — har chaqiruvda yangisi yaratilsa `useSyncExternalStore`
 * cheksiz qayta render qilardi.
 */
const SERVER_STATE: NotificationState = {
  items: [],
  sections: {},
  total: 0,
  loading: true,
  error: null,
};

export function useNotifications(): NotificationState & {
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: (section?: string) => Promise<void>;
} {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER_STATE);

  const markRead = useCallback(async (ids: string[]) => {
    await apiMarkRead(ids);
    reload();
  }, []);

  const markAllRead = useCallback(async (section?: string) => {
    await apiMarkAllRead(section);
    reload();
  }, []);

  return { ...state, markRead, markAllRead };
}

/**
 * Yon menyudagi sanoq uchun qisqa yoʻl.
 *
 * Boʻlim id — `core/sections.py` dagi manzil, ya'ni menyudagi `href`
 * ning oʻzi. Shu sabab menyuga yangi band qoʻshilganda bu yerda hech
 * narsa oʻzgartirilmaydi.
 */
export function useSectionBadges(): Record<string, number> {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER_STATE).sections;
}
