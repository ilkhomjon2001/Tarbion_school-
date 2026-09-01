"use client";

/**
 * Eʼlonlar (T-020, ADM-12) — backend qatlami.
 *
 * Kim nimani koʻrishi SERVERDA hal boʻladi: oʻquvchi va ota-ona faqat
 * butun maktab va oʻz sinfi eʼlonlarini oladi, ustoz oʻzi berganlarini.
 * Bu faylda hech qanday filtr yoʻq — bor boʻlsa, u yolgʻon boʻlardi.
 */

import {
  announcementsArchive,
  announcementsCreate,
  announcementsListAnnouncements,
  announcementsPreview,
  announcementsTargets,
} from "@/lib/api/sdk.gen";
import type { AnnouncementOut, TargetsOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { AnnouncementOut, TargetsOut };

export const AUDIENCE_LABELS: Record<string, string> = {
  school: "Butun maktab",
  class: "Sinf",
  subject: "Fan",
};

export async function fetchAnnouncements(): Promise<AnnouncementOut[]> {
  return withAuth<AnnouncementOut[]>(() => announcementsListAnnouncements({}));
}

/** Ustoz eʼlon bera oladigan sinflar va fanlar — dars jadvalidan. */
export async function fetchTargets(): Promise<TargetsOut> {
  return withAuth<TargetsOut>(() => announcementsTargets({}));
}

/** ADM-12: yuborishdan OLDIN «nechta odamga ketadi». */
export async function previewRecipients(
  audience: string,
  targetId?: string,
): Promise<number> {
  const r = await withAuth<{ recipients: number }>(() =>
    announcementsPreview({
      query: {
        audience,
        class_id: audience === "class" ? targetId : undefined,
        subject_id: audience === "subject" ? targetId : undefined,
      },
    }),
  );
  return r.recipients;
}

export async function createAnnouncement(input: {
  audience: string;
  title: string;
  body: string;
  targetId?: string;
  important?: boolean;
}): Promise<AnnouncementOut> {
  return withAuth<AnnouncementOut>(() =>
    announcementsCreate({
      body: {
        audience: input.audience,
        title: input.title,
        body: input.body,
        class_id: input.audience === "class" ? input.targetId : undefined,
        subject_id: input.audience === "subject" ? input.targetId : undefined,
        important: input.important ?? false,
      },
    }),
  );
}

/** Olib tashlash — arxivlash. Yetkazilgan bildirishnomalar qoladi. */
export async function archiveAnnouncement(id: string): Promise<void> {
  await withAuth(() => announcementsArchive({ path: { announcement_id: id } }));
}
