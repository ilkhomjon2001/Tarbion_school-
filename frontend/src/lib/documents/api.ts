"use client";

/**
 * Maʼlumotnomalar — backend qatlami. Butun modul `students.manage`
 * huquqi bilan; ustoz va ota-onaga server 403 beradi.
 */

import {
  documentsArchive,
  documentsCreate,
  documentsIssue,
  documentsQueue,
  documentsRegistry,
  documentsSetWaiting,
} from "@/lib/api/sdk.gen";
import type { DocumentOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { DocumentOut };

export const DOC_TYPE_LABELS: Record<string, string> = {
  oquv_joyi: "Oʻquv joyi haqida",
  daromad: "Daromad uchun",
  harbiy: "Harbiy komissariat uchun",
  baho_kochirmasi: "Baho koʻchirmasi",
  tibbiy: "Tibbiy maʼlumotnoma (086-U)",
};

export const DOC_STATUS_LABELS: Record<string, string> = {
  new: "Yangi",
  waiting: "Kutishda",
  issued: "Berildi",
};

export async function fetchQueue(): Promise<DocumentOut[]> {
  return withAuth<DocumentOut[]>(() => documentsQueue({}));
}

export async function fetchRegistry(): Promise<DocumentOut[]> {
  return withAuth<DocumentOut[]>(() => documentsRegistry({}));
}

export async function createDocumentRequest(
  studentId: string,
  docType: string,
  requestedBy: string,
): Promise<DocumentOut> {
  return withAuth<DocumentOut>(() =>
    documentsCreate({
      body: { student_id: studentId, doc_type: docType, requested_by: requestedBy },
    }),
  );
}

export async function setDocumentWaiting(id: string): Promise<DocumentOut> {
  return withAuth<DocumentOut>(() => documentsSetWaiting({ path: { doc_id: id } }));
}

/** Berish — shundan keyin yozuv oʻzgarmaydi, reyestrga tushadi (X-13). */
export async function issueDocument(
  id: string,
  input: { recipient: string; copies: number; extraText?: string },
): Promise<DocumentOut> {
  return withAuth<DocumentOut>(() =>
    documentsIssue({
      path: { doc_id: id },
      body: {
        recipient: input.recipient,
        copies: input.copies,
        extra_text: input.extraText ?? null,
      },
    }),
  );
}

export async function archiveDocument(id: string): Promise<void> {
  await withAuth(() => documentsArchive({ path: { doc_id: id } }));
}
