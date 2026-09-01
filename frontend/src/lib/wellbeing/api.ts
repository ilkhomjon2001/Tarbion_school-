"use client";

/**
 * Tarbiyaviy va psixologik qaydlar — backend qatlami.
 *
 * Kim nimani koʻrishi SERVERDA: fan ustoziga psixologik yozuvlar
 * umuman kelmaydi, begona oilaga 403. Bu faylda filtr yoʻq.
 */

import {
  wellbeingArchiveNote,
  wellbeingCreateNote,
  wellbeingNotesOfStudent,
} from "@/lib/api/sdk.gen";
import type { WellbeingNoteOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { WellbeingNoteOut };

export const TONE_LABELS: Record<string, string> = {
  positive: "Ijobiy",
  neutral: "Odatiy",
  attention: "Eʼtibor talab qiladi",
};

export const KIND_LABELS: Record<string, string> = {
  behavior: "Tarbiyaviy",
  psychology: "Psixologik",
};

export async function fetchNotes(studentId: string): Promise<WellbeingNoteOut[]> {
  return withAuth<WellbeingNoteOut[]>(() =>
    wellbeingNotesOfStudent({ path: { student_id: studentId } }),
  );
}

export async function createNote(input: {
  studentId: string;
  kind: string;
  tone: string;
  text: string;
  subjectId?: string | null;
}): Promise<WellbeingNoteOut> {
  return withAuth<WellbeingNoteOut>(() =>
    wellbeingCreateNote({
      body: {
        student_id: input.studentId,
        kind: input.kind,
        tone: input.tone,
        text: input.text,
        subject_id: input.subjectId ?? null,
      },
    }),
  );
}

export async function archiveNote(noteId: string): Promise<void> {
  await withAuth(() => wellbeingArchiveNote({ path: { note_id: noteId } }));
}
