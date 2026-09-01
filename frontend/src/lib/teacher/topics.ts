"use client";

/**
 * Mavzu qidirish va bashorat qilish.
 *
 * Ustoz davomat belgilayotganda mavzu maydonini qoʻlda toʻldirmasin:
 *
 *   1. Sukut boʻyicha — rejadagi keyingi mavzu avtomatik qoʻyiladi
 *   2. Ustoz boshqa mavzu yozsa — yozgan matniga mos mavzular bazadan
 *      taklif qilinadi (bir necha harfdan keyin)
 *   3. Baribir mos kelmasa — oʻz matnini yozaveradi
 *
 * Baza `public/reja/daraxt.json` da (180 KB), bir marta yuklanadi va
 * xotirada saqlanadi.
 */

export interface TopicSuggestion {
  title: string;
  model: string | null;
  year: string;
  className: string;
  term: string;
  index: number;
  /** Qidiruv mosligi — kichik son yaxshiroq. */
  score: number;
}

interface RawLesson {
  t: string;
  m: string | null;
  y: string | null;
}
type Tree = Record<string, Record<string, Record<string, RawLesson[]>>>;

interface FlatTopic {
  title: string;
  lower: string;
  model: string | null;
  modelLower: string;
  year: string;
  className: string;
  term: string;
  index: number;
}

let cache: FlatTopic[] | null = null;
let loading: Promise<FlatTopic[]> | null = null;

/**
 * ASCII `'` → oʻzbek apostrofi (CLAUDE.md 8-qoida).
 *
 * Baza fayli (`daraxt.json`) ASCII apostrof bilan yozilgan; u tuzatilguncha
 * mavzular BAZAGA notoʻgʻri belgida yozilib qolmasin. Qoida: o/g dan
 * keyin — ʻ (U+02BB), boshqa oʻrinda tutuq belgisi — ʼ (U+02BC).
 */
function fixApostrophes(text: string): string {
  return text
    .replace(/([oOgG])['‘’`]/g, "$1ʻ")
    .replace(/['‘’`]/g, "ʼ");
}

async function loadTopics(): Promise<FlatTopic[]> {
  if (cache) return cache;
  if (loading) return loading;

  loading = fetch("/reja/daraxt.json")
    .then((r) => r.json() as Promise<Tree>)
    .then((tree) => {
      const flat: FlatTopic[] = [];
      for (const [year, classes] of Object.entries(tree)) {
        for (const [className, terms] of Object.entries(classes)) {
          for (const [term, lessons] of Object.entries(terms)) {
            lessons.forEach((l, index) => {
              const title = fixApostrophes(l.t);
              const model = l.m === null ? null : fixApostrophes(l.m);
              flat.push({
                title,
                lower: title.toLowerCase(),
                model,
                modelLower: (model ?? "").toLowerCase(),
                year,
                className,
                term,
                index,
              });
            });
          }
        }
      }
      cache = flat;
      return flat;
    })
    .catch(() => {
      cache = [];
      return [];
    });

  return loading;
}

/** Sahifa ochilishida oldindan yuklab qoʻyish — birinchi yozishda kutmasin. */
export function warmTopics(): void {
  void loadTopics();
}

/**
 * Yozilgan matnga mos mavzular.
 *
 * Saralash: avval sarlavha boshidan mos kelganlari, keyin ichida
 * uchraganlari, oxirida model nomi boʻyicha topilganlari. Bir xil
 * sarlavha bir necha sinfda uchraydi — takrorlanmaydi.
 */
export async function suggestTopics(
  query: string,
  limit = 8,
): Promise<TopicSuggestion[]> {
  // Ustoz ASCII `'` terishi mumkin — qidiruv baribir topsin.
  const q = fixApostrophes(query.trim()).toLowerCase();
  if (q.length < 2) return [];

  const all = await loadTopics();
  const seen = new Set<string>();
  const out: TopicSuggestion[] = [];

  for (const t of all) {
    if (seen.has(t.lower)) continue;

    let score: number;
    if (t.lower.startsWith(q)) score = 0;
    else if (t.lower.includes(q)) score = 1;
    else if (t.modelLower.includes(q)) score = 2;
    else continue;

    seen.add(t.lower);
    out.push({
      title: t.title,
      model: t.model,
      year: t.year,
      className: t.className,
      term: t.term,
      index: t.index,
      score,
    });
  }

  return out
    .sort((a, b) => (a.score === b.score ? a.title.length - b.title.length : a.score - b.score))
    .slice(0, limit);
}

/**
 * Berilgan sinf va chorakning mavzulari — ustoz oʻz sinfining rejasidan
 * tanlash uchun (butun bazadan emas).
 */
export async function topicsForClass(
  year: string,
  className: string,
  term: string,
): Promise<TopicSuggestion[]> {
  const all = await loadTopics();
  return all
    .filter((t) => t.year === year && t.className === className && t.term === term)
    .map((t) => ({
      title: t.title,
      model: t.model,
      year: t.year,
      className: t.className,
      term: t.term,
      index: t.index,
      score: 0,
    }));
}
