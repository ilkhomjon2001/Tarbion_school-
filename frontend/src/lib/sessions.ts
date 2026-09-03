/**
 * Faol qurilmalar (T-004, AUT-09 kengaytmasi).
 *
 * Loyiha egasining soʻrovi (2026-08-29): maktab va umumiy
 * kompyuterlarda hisob ochiq qolib ketmasin.
 *
 * `user_id` HECH QAYERDA yuborilmaydi — server uni tokendan oladi.
 * Shu sababli bu yerdan boshqa odamning sessiyasini koʻrish yoki
 * bekor qilish mumkin emas.
 */

import {
  authListSessions,
  authRevokeOtherSessions,
  authRevokeSessionById,
} from "@/lib/api/sdk.gen";
import type { SessionOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { SessionOut };

export async function fetchSessions(): Promise<SessionOut[]> {
  return withAuth<SessionOut[]>(() => authListSessions({}));
}

export async function revokeSession(familyId: string): Promise<number> {
  const r = await withAuth<{ revoked: number }>(() =>
    authRevokeSessionById({ path: { family_id: familyId } }),
  );
  return r.revoked;
}

export async function revokeOtherSessions(): Promise<number> {
  const r = await withAuth<{ revoked: number }>(() => authRevokeOtherSessions({}));
  return r.revoked;
}

/**
 * `User-Agent` ni odam oʻqiydigan nomga aylantiradi.
 *
 * Toʻliq satr foydasiz uzun ("Mozilla/5.0 (Windows NT 10.0; Win64…").
 * Odamga kerak boʻlgani bitta savolga javob: «bu menmi yoki
 * begonami» — yaʼni qurilma turi va brauzer.
 */
export function qurilmaNomi(ua: string | null | undefined): string {
  if (!ua) return "Nomaʼlum qurilma";

  const brauzer =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /YaBrowser/.test(ua) ? "Yandex"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : null;

  const tizim =
    /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iPhone/iPad"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac"
    : /Linux/.test(ua) ? "Linux"
    : null;

  if (brauzer && tizim) return `${brauzer} · ${tizim}`;
  if (brauzer) return brauzer;
  if (tizim) return tizim;
  // Tanib boʻlmadi — xom satrni qisqartirib koʻrsatamiz, chunki
  // «Nomaʼlum» deb yozish odamga hech narsa bermaydi.
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
}
