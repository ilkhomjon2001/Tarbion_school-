/**
 * Choraklar (ADM-01, T-007) va dars rejasining kalendarga bogʻlanishi.
 *
 * ── Chorak mantigʻi ────────────────────────────────────────────────────
 *
 * Maktab yili 4 chorakka boʻlinadi, oralarida taʼtil. Chorak — shunchaki
 * sana oraligʻi emas, u uchta narsani belgilaydi:
 *
 *   1. Dars generatsiyasi — darslar faqat chorak ichidagi ish kunlariga
 *      yaratiladi, taʼtil va bayramlarda yaratilmaydi (T-012).
 *   2. Dars rejasi — metodik baza chorak kesimida tuzilgan: har chorakda
 *      21 ta dars, ketma-ket. Ustoz bugun nechanchi darsda ekani
 *      choraklarning boshidan sanaladi.
 *   3. Baho — chorak bahosi shu oraliqdagi baholardan hisoblanadi (JUR-04).
 *
 * ── Reja qanday bogʻlanadi ────────────────────────────────────────────
 *
 * Rejadagi dars raqami SANAGA emas, KETMA-KETLIKKA bogʻlanadi:
 *
 *     reja_indeksi = chorak boshidan shu sinf+fan boʻyicha
 *                    oʻtkazilgan darslar soni
 *
 * Nega sanaga emas: dars bekor boʻlsa (ustoz kasal, bayram koʻchdi),
 * sanaga bogʻlangan reja butunlay siljib ketadi. Ketma-ketlikda esa reja
 * oʻzini oʻzi tuzatadi — keyingi dars oʻsha toʻxtagan joydan davom etadi.
 *
 * ── Dastur yili ───────────────────────────────────────────────────────
 *
 * Bazada "1-yil / 2-yil" — bu maktab oʻquv yili EMAS, dastur yili:
 * oʻquvchi fanni necha yildan beri oʻqiyapti. Bitta 7-sinfning ikki
 * guruhi turli yilda boʻlishi mumkin, shuning uchun yil sinf nomidan
 * chiqarilmaydi — sinfning oʻzida saqlanadi.
 */

export interface Term {
  index: number;
  name: string;
  startsOn: string;
  endsOn: string;
}

/**
 * 2026–2027 oʻquv yili.
 *
 * Standart Oʻzbekiston taqvimi, bitta farq bilan: 1-chorak 2-sentabr
 * emas, 24-avgustda boshlanadi — xususiy maktablar odatda erta
 * boshlaydi va demo kuni (29-avgust) chorak ichida qolishi kerak.
 * Admin bu sanalarni tahrirlaydi (T-007).
 */
export const TERMS: Term[] = [
  { index: 1, name: "1-chorak", startsOn: "2026-08-24", endsOn: "2026-10-30" },
  { index: 2, name: "2-chorak", startsOn: "2026-11-09", endsOn: "2026-12-30" },
  { index: 3, name: "3-chorak", startsOn: "2027-01-12", endsOn: "2027-03-20" },
  { index: 4, name: "4-chorak", startsOn: "2027-04-01", endsOn: "2027-05-25" },
];

export const ACADEMIC_YEAR = "2026–2027";

/** Taʼtillar — choraklar orasidagi tanaffuslar. */
export const BREAKS: { name: string; startsOn: string; endsOn: string }[] = [
  { name: "Kuzgi taʼtil", startsOn: "2026-10-31", endsOn: "2026-11-08" },
  { name: "Qishki taʼtil", startsOn: "2026-12-31", endsOn: "2027-01-11" },
  { name: "Bahorgi taʼtil", startsOn: "2027-03-21", endsOn: "2027-03-31" },
];

export function termForDate(date: string): Term | null {
  return TERMS.find((t) => date >= t.startsOn && date <= t.endsOn) ?? null;
}

export function breakForDate(date: string) {
  return BREAKS.find((b) => date >= b.startsOn && date <= b.endsOn) ?? null;
}

/** Chorakning necha foizi oʻtgani — panelda progress koʻrsatish uchun. */
export function termProgress(term: Term, today: string): number {
  const start = Date.parse(term.startsOn);
  const end = Date.parse(term.endsOn);
  const now = Math.min(Math.max(Date.parse(today), start), end);
  return Math.round(((now - start) / (end - start)) * 100);
}

/** Chorakda nechanchi hafta ketyapti. */
export function termWeek(term: Term, today: string): number {
  const days = (Date.parse(today) - Date.parse(term.startsOn)) / 86_400_000;
  return Math.floor(days / 7) + 1;
}

/**
 * Sinfning fan boʻyicha dastur yili.
 *
 * Backendda bu `class_subjects.program_year` boʻladi. Hozir demo uchun
 * shu yerda.
 */
export const CLASS_PROGRAM_YEAR: Record<string, number> = {
  "7-A": 2,
  "6-B": 1,
};

/** Rejada nechta dars borligi (chorakiga). */
export const LESSONS_PER_TERM = 21;
