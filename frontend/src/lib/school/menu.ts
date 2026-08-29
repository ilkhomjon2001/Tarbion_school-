/**
 * Maktab oshxonasi menyusi.
 *
 * DIQQAT: TZ 10-boʻlimida "oshxona moduli" ishlar doirasiga KIRMAYDI deb
 * yozilgan — bu loyiha egasining alohida soʻrovi bilan qoʻshilgan
 * (docs/DECISIONS.md ga qara).
 *
 * Menyu FAQAT ota-ona kabinetida koʻrsatiladi (loyiha egasi qarori):
 * ovqatni ota-ona tanlaydi va toʻlaydi, oʻquvchiga kerak emas.
 */
import type { DailyMenu } from "@/lib/types";

/**
 * Keyingi 1 hafta (bugundan boshlab 7 kun). 1-sentabr — Mustaqillik kuni,
 * dars boʻlmagani uchun oshxona ham ishlamaydi (teacher/schedule.ts dagi
 * HOLIDAYS bilan mos).
 */
export const weeklyMenu: DailyMenu[] = [
  {
    date: "2026-08-29",
    meals: [
      { id: "m-0829-b", mealType: "breakfast", time: "08:00", dishes: ["Qaymoqli bo'tqa", "Non", "Choy"] },
      { id: "m-0829-l", mealType: "lunch", time: "12:30", dishes: ["Sho'rva", "Manti", "Bahor salatasi", "Kompot"] },
      { id: "m-0829-s", mealType: "snack", time: "16:00", dishes: ["Mevali salat", "Kefir"] },
    ],
  },
  {
    date: "2026-08-30",
    meals: [
      { id: "m-0830-b", mealType: "breakfast", time: "08:00", dishes: ["Bulgʻur bo'tqasi", "Pishloq", "Choy"] },
      { id: "m-0830-l", mealType: "lunch", time: "12:30", dishes: ["Dimlama", "Yashil salat", "Non", "Kompot"] },
      { id: "m-0830-s", mealType: "snack", time: "16:00", dishes: ["Tvorogli vareniki", "Sut"] },
    ],
  },
  {
    date: "2026-08-31",
    meals: [
      { id: "m-0831-b", mealType: "breakfast", time: "08:00", dishes: ["Sosiska qovurma", "Non", "Kakao"] },
      { id: "m-0831-l", mealType: "lunch", time: "12:30", dishes: ["Sabzavotli osh", "Achchiq-chuchuk salat", "Non", "Kompot"] },
      { id: "m-0831-s", mealType: "snack", time: "16:00", dishes: ["Vafli", "Kefir"] },
    ],
  },
  {
    date: "2026-09-01",
    meals: [],
    note: "Mustaqillik kuni — dars yoʻq, oshxona ishlamaydi.",
  },
  {
    date: "2026-09-02",
    meals: [
      { id: "m-0902-b", mealType: "breakfast", time: "08:00", dishes: ["Qovurilgan tuxum", "Pomidor", "Non", "Choy"] },
      { id: "m-0902-l", mealType: "lunch", time: "12:30", dishes: ["Moshxoʻrda", "Salat", "Non", "Kompot"] },
      { id: "m-0902-s", mealType: "snack", time: "16:00", dishes: ["Mevali salat", "Yogurt"] },
    ],
  },
  {
    date: "2026-09-03",
    meals: [
      { id: "m-0903-b", mealType: "breakfast", time: "08:00", dishes: ["Asalli grenka", "Sut"] },
      { id: "m-0903-l", mealType: "lunch", time: "12:30", dishes: ["Goʻshtli sho'rva", "Dimlangan tovuq", "Guruch", "Kompot"] },
      { id: "m-0903-s", mealType: "snack", time: "16:00", dishes: ["Pishloqli krekerlar", "Kefir"] },
    ],
  },
  {
    date: "2026-09-04",
    meals: [
      { id: "m-0904-b", mealType: "breakfast", time: "08:00", dishes: ["Bulochka", "Murabbo", "Choy"] },
      { id: "m-0904-l", mealType: "lunch", time: "12:30", dishes: ["Sabzavotli sho'rva", "Tovuq kotleti", "Kartoshka pyuresi", "Kompot"] },
      { id: "m-0904-s", mealType: "snack", time: "16:00", dishes: ["Mevalar (uzum, olma)", "Ryajenka"] },
    ],
  },
];
