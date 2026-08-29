import type { GradeEntry, GradeType } from "@/lib/types";

/**
 * JUR-03: baho turi boʻyicha vazn. Nazorat ishi joriy bahodan koʻproq
 * og'irlikka ega. "Chorak" va "yillik" — bu formulaning natijasi, kirish
 * qiymati sifatida hisobga olinmaydi.
 */
export const GRADE_WEIGHTS: Record<GradeType, number> = {
  joriy: 1,
  nazorat: 2,
  chorak: 0,
  yillik: 0,
};

/**
 * JUR-04: choraklik oʻrtacha baho vaznlar asosida avtomatik hisoblanadi.
 * Backend ulanganda bu yerda ustozning qoʻlda tuzatishi (sabab bilan)
 * ustunlik qiladi — hozircha faqat avtomatik hisoblash mavjud.
 */
export function computeWeightedAverage(entries: GradeEntry[]): number {
  const weighted = entries.filter((entry) => GRADE_WEIGHTS[entry.type] > 0);
  if (weighted.length === 0) return 0;
  const totalWeight = weighted.reduce((sum, entry) => sum + GRADE_WEIGHTS[entry.type], 0);
  const totalValue = weighted.reduce(
    (sum, entry) => sum + entry.value * GRADE_WEIGHTS[entry.type],
    0,
  );
  return Math.round((totalValue / totalWeight) * 10) / 10;
}

/** Taxminiy chorak bahosi — vaznli oʻrtachaning yaqin butun songa yaxlitlanishi. */
export function estimateQuarterGrade(entries: GradeEntry[]): number {
  return Math.round(computeWeightedAverage(entries));
}
