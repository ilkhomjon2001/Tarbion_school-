"use client";

/**
 * Sababli qoldirish arizasi (DAV-04) — backend qatlami.
 *
 * Bu yerda qoida yoʻq. «Vasiy faqat oʻz farzandiga ariza yozadi»,
 * «sinf rahbari tasdiqlaydi», «rad etishda sabab majburiy» —
 * hammasi serverda. Frontend serverdan kelgan `can_decide` va
 * `status` ni chizadi (CLAUDE.md 7-qoida).
 */

import {
  attendanceCancelAbsenceRequest,
  attendanceCreateAbsenceRequest,
  attendanceDecideAbsenceRequest,
  attendanceGetAbsenceRequest,
  attendanceListAbsenceRequests,
  filesUpload,
} from "@/lib/api/sdk.gen";
import type { AbsenceOut, FileOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { AbsenceOut, FileOut };

export const ABSENCE_STATUS_LABELS: Record<string, string> = {
  kutilmoqda: "Koʻrib chiqilmoqda",
  tasdiqlangan: "Tasdiqlangan",
  rad_etilgan: "Rad etilgan",
  bekor_qilingan: "Bekor qilingan",
};

/** MET-03 dagi roʻyxat — `accept` atributi uchun. */
export const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.mp4";

export async function uploadFile(file: File): Promise<FileOut> {
  return withAuth<FileOut>(() => filesUpload({ body: { file } }));
}

export async function createAbsenceRequest(params: {
  studentId: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
  fileId?: string | null;
}): Promise<AbsenceOut> {
  return withAuth<AbsenceOut>(() =>
    attendanceCreateAbsenceRequest({
      body: {
        student_id: params.studentId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        reason: params.reason,
        file_id: params.fileId ?? null,
      },
    }),
  );
}

export async function listAbsenceRequests(params?: {
  status?: string;
  studentId?: string;
}): Promise<AbsenceOut[]> {
  return withAuth<AbsenceOut[]>(() =>
    attendanceListAbsenceRequests({
      query: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.studentId ? { student_id: params.studentId } : {}),
      },
    }),
  );
}

/**
 * Bitta ariza — ilovaga imzolangan havola bilan.
 *
 * Havola roʻyxatda kelmaydi: har qatorga 15 daqiqalik kalit tarqatish
 * X-7 ga zid. Shuning uchun ilovani koʻrish uchun aynan shu chaqiruv.
 */
export async function getAbsenceRequest(id: string): Promise<AbsenceOut> {
  return withAuth<AbsenceOut>(() =>
    attendanceGetAbsenceRequest({ path: { request_id: id } }),
  );
}

export async function decideAbsenceRequest(
  id: string,
  approve: boolean,
  note?: string,
): Promise<AbsenceOut> {
  return withAuth<AbsenceOut>(() =>
    attendanceDecideAbsenceRequest({
      path: { request_id: id },
      body: { approve, note: note ?? null },
    }),
  );
}

export async function cancelAbsenceRequest(id: string): Promise<AbsenceOut> {
  return withAuth<AbsenceOut>(() =>
    attendanceCancelAbsenceRequest({ path: { request_id: id } }),
  );
}
