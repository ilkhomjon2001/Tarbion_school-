import { GRADE_WEIGHTS } from "@/lib/contracts";
import type { GradeEntry } from "@/lib/types";

export { GRADE_WEIGHTS };

/**
 * JUR-04: choraklik oʻrtacha baho vaznlar asosida avtomatik hisoblanadi.
 *
 * Vazn jadvali `lib/contracts.ts` da — bitta manba. Ilgari bu yerda
 * alohida jadval bor edi va nazorat ishi 2 ga teng edi, ustoz jurnalida
 * esa 3 ga: bir xil baholardan ikki xil oʻrtacha chiqardi.
 *
 * Backend ulanganda ustozning qoʻlda tuzatishi (sabab bilan) ustunlik
 * qiladi — hozircha faqat avtomatik hisoblash mavjud.
 */
export function computeWeightedAverage(entries: GradeEntry[]): number {
  const weighted = entries.filter((entry) => GRADE_WEIGHTS[entry.kind] > 0);
  if (weighted.length === 0) return 0;
  const totalWeight = weighted.reduce((sum, entry) => sum + GRADE_WEIGHTS[entry.kind], 0);
  const totalValue = weighted.reduce(
    (sum, entry) => sum + entry.value * GRADE_WEIGHTS[entry.kind],
    0,
  );
  return Math.round((totalValue / totalWeight) * 10) / 10;
}

/** Taxminiy chorak bahosi — vaznli oʻrtachaning yaqin butun songa yaxlitlanishi. */
export function estimateQuarterGrade(entries: GradeEntry[]): number {
  return Math.round(computeWeightedAverage(entries));
}
