/**
 * Ustozning huquqlari — kim nimaga baho qoʻya oladi (CLAUDE.md 7-qoida).
 *
 * Ikki xil rol, ikki xil huquq:
 *
 *   FAN USTOZI     — oʻzi dars beradigan FANDAN baho QOʻYADI.
 *                    Algebra ustozi algebra bahosini qoʻyadi, geometriya
 *                    bahosiga tegmaydi.
 *
 *   SINF RAHBARI   — oʻz sinfining BARCHA fanlaridagi baholarni KOʻRADI,
 *                    lekin oʻzgartira olmaydi. U sinfning umumiy holatini
 *                    kuzatadi, boshqa ustozning bahosini tuzatmaydi.
 *
 * Bitta odam ikkala rolda ham boʻlishi mumkin: 11-A ning sinf rahbari
 * oʻsha sinfda algebra ham oʻqitadi — algebrada baho qoʻyadi, qolgan
 * fanlarni faqat koʻradi.
 *
 * Hozir bu frontend darajasida. Backend ulanganda tekshiruv soʻrov
 * darajasida takrorlanadi (`services/access.py`) — frontendda yashirish
 * himoya emas.
 */

/** Ustoz qaysi sinfda qaysi fandan dars beradi. */
export const TEACHING: Record<string, string[]> = {
  "11-A": ["Matematika", "Algebra"],
  "9-B": ["Matematika"],
  "10-A": ["Geometriya"],
  "7-A": ["Robototexnika"],
  "6-B": ["Robototexnika"],
};

/** Ustoz sinf rahbari boʻlgan sinflar. */
export const HOMEROOM_OF = ["11-A"];

/** Sinfda oʻqitiladigan barcha fanlar — sinf rahbari koʻrinishi uchun. */
export const CLASS_ALL_SUBJECTS: Record<string, string[]> = {
  "11-A": ["Matematika", "Algebra", "Geometriya", "Fizika", "Ona tili"],
  "9-B": ["Matematika", "Ona tili", "Ingliz tili"],
  "10-A": ["Geometriya", "Algebra", "Fizika"],
  "7-A": ["Robototexnika", "Matematika", "Ona tili"],
  "6-B": ["Robototexnika", "Matematika", "Ingliz tili"],
};

/** Ustoz kira oladigan sinflar — dars beradigan va rahbarlik qiladigan. */
export function myClasses(): string[] {
  return Array.from(new Set([...Object.keys(TEACHING), ...HOMEROOM_OF])).sort();
}

/** Shu sinfda oʻzi oʻqitadigan fanlar — faqat shularga baho qoʻyadi. */
export function mySubjectsIn(className: string): string[] {
  return TEACHING[className] ?? [];
}

export function isHomeroomOf(className: string): boolean {
  return HOMEROOM_OF.includes(className);
}

/** Shu sinf+fanda baho qoʻyishga ruxsat bormi. */
export function canGrade(className: string, subject: string): boolean {
  return mySubjectsIn(className).includes(subject);
}

/** Sinfning barcha fanlari — faqat sinf rahbari uchun. */
export function allSubjectsIn(className: string): string[] {
  return CLASS_ALL_SUBJECTS[className] ?? mySubjectsIn(className);
}
