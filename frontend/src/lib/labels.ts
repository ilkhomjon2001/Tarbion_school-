/**
 * Interfeys yorliqlari.
 *
 * Backend bilan umumiy kodlarning yorligʻi `lib/contracts.ts` da —
 * u yerdagilar `backend/app/models/` dagi `*_LABELS_UZ` lugʻatlarining
 * aksi. Bu yerda ular qayta eksport qilinadi va faqat frontendga
 * tegishli yorliqlar (ovqat turi kabi) qoʻshiladi.
 */

import type { MealType } from "@/lib/types";

export {
  ATTENDANCE_LABELS,
  ATTENDANCE_TONE,
  GRADE_KIND_LABELS,
  SUBMISSION_LABELS,
  SUBMISSION_TONE,
} from "@/lib/contracts";

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Nonushta",
  lunch: "Tushlik",
  snack: "Kechki yengil taom",
};
