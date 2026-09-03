/**
 * Xabar navbati jurnali klienti (BOT-06).
 *
 * `body` maxfiy turlarda serverda MASKALANGAN — parolni tiklash kodi
 * jurnalga chiqmaydi (X-10). Frontend uni qaytadan tiklay olmaydi va
 * bu ataylab shunday.
 */

import {
  notificationsOutboxCounts,
  notificationsOutboxList,
  notificationsOutboxRetry,
  notificationsOutboxRetryFailed,
} from "@/lib/api/sdk.gen";
import type { OutboxCountsOut, OutboxRowOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { OutboxCountsOut, OutboxRowOut };

export type OutboxStatus = "pending" | "sent" | "failed" | "cancelled";

export const OUTBOX_STATUS_LABELS: Record<OutboxStatus, string> = {
  pending: "Navbatda",
  sent: "Yuborildi",
  failed: "Yiqildi",
  cancelled: "Bekor qilindi",
};

/** `template_service.DEFAULTS` dagi turlar bilan bir xil nomlar. */
export const OUTBOX_KIND_LABELS: Record<string, string> = {
  attendance_absent: "Darsga kelmadi",
  attendance_late: "Darsga kechikdi",
  attendance_daily: "Kunlik xulosa",
  account_created: "Kirish maʼlumotlari",
  password_reset: "Parolni tiklash",
};

export async function fetchOutbox(
  status: OutboxStatus,
  limit = 100,
): Promise<OutboxRowOut[]> {
  return withAuth<OutboxRowOut[]>(() =>
    notificationsOutboxList({ query: { status, limit } }),
  );
}

export async function fetchOutboxCounts(): Promise<OutboxCountsOut> {
  return withAuth<OutboxCountsOut>(() => notificationsOutboxCounts({}));
}

export async function retryOutbox(id: string): Promise<number> {
  const r = await withAuth<{ retried: number }>(() =>
    notificationsOutboxRetry({ path: { outbox_id: id } }),
  );
  return r.retried;
}

export async function retryAllFailed(): Promise<number> {
  const r = await withAuth<{ retried: number }>(() =>
    notificationsOutboxRetryFailed({}),
  );
  return r.retried;
}
