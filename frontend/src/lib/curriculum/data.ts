"use client";

/**
 * Dars rejasi (metodik baza) — statik JSON qatlami.
 *
 * Kontent `public/reja/robototexnika/` ostida yotadi va sinf tanlanganda
 * bitta fayl sifatida yuklanadi (~350KB, keshda qoladi). Bu shaxsiy
 * maʼlumot emas — metodik material, shuning uchun auth talab qilinmaydi.
 *
 * Manba: Robbit akademiya oʻquv rejasi (bir martalik konvertatsiya,
 * apostroflar 8-qoidaga keltirilgan).
 */

export interface SinfStat {
  darslar: number;
  modellar: number;
  /** Rasmli instruksiyasi bor darslar soni. */
  rasmli: number;
}

export interface RejaIndex {
  fan: string;
  /** yil → sinf → statistikasi. */
  yillar: Record<string, Record<string, SinfStat>>;
}

export interface NazariyaBlok {
  title: string;
  points: string[];
}

export interface DarsKod {
  nom: string;
  izoh: string;
  matn: string;
}

export interface DarsMezon {
  turi?: string;
  nom?: string;
  vaqt?: number;
  ustunlar: string[];
  qatorlar: string[][];
}

export interface DarsTopshiriq {
  missiya?: number;
  missiyaNomi?: string;
  kod?: string;
  sarlavha?: string;
  talablar?: string[];
  [k: string]: unknown;
}

export interface UlanishBlok {
  nom: string;
  tasnif: string[];
}

export interface DarsMeta {
  sinf?: string;
  yil?: string;
  chorak?: string;
  darsRaqami?: string;
  modul?: string;
  jihoz?: string;
  davomiyligi?: string;
}

export interface Dars {
  title: string;
  model: string | null;
  type: string;
  /** Instruksiya rasmi slugʼi — `rasmUrl()` bilan thumbnail. */
  slug?: string | null;
  /** Qurish instruksiyasidagi qadamlar soni. */
  qadam?: number | null;
  maqsad?: string[];
  lugat?: string[];
  softSkill?: string;
  resurslar?: string[];
  nazariya?: NazariyaBlok[];
  amaliy?: NazariyaBlok[];
  uyga?: string[];
  /** MET-02: dars oxirida oʻquvchi nima qila oladi. */
  natija?: string;
  /** MET-02: kerakli jihozlar — qidiruvga tushadi (MET-05). */
  jihoz?: string[];
  /**
   * MET-02: baholash mezonlari.
   *
   * Nomi `mezon` EMAS: statik Robototexnika bazasida `mezon` boshqa
   * maʼnoda (baholash jadvali) band.
   */
  baholash?: string[];
  /** MET-04: tashqi video havola — kartochka ichida koʻrsatiladi. */
  video?: string;
  /** MET-03: ilova qilingan fayllar. */
  files?: { id: string; name: string }[];
  meta?: DarsMeta;
  topshiriq?: DarsTopshiriq;
  kod?: DarsKod;
  qollanma?: { matn: string };
  ulanish?: UlanishBlok[];
  mezon?: DarsMezon;
}

export interface SinfReja {
  yil: string;
  sinf: string;
  choraklar: { nom: string; darslar: Dars[] }[];
}

/** Dars turi → yorliq va rang toni (mavjud tokenlar, xom hex yoʻq). */
export const TYPE_META: Record<string, { label: string; cls: string }> = {
  qurish: { label: "Qurish", cls: "bg-brand-tint text-brand-dark" },
  dasturlash: { label: "Dasturlash", cls: "bg-success-tint text-success" },
  spike: { label: "SPIKE", cls: "bg-warning-tint text-warning" },
  arduino: { label: "Arduino", cls: "bg-warning-tint text-warning" },
  esp32: { label: "ESP32", cls: "bg-warning-tint text-warning" },
  elektronika: { label: "Elektronika", cls: "bg-warning-tint text-warning" },
  ai: { label: "AI", cls: "bg-success-tint text-success" },
  nazorat: { label: "Nazorat", cls: "bg-danger-tint text-danger" },
  loyiha: { label: "Loyiha", cls: "bg-surface-muted text-foreground" },
};

import {
  curriculumPublishedCatalog,
  curriculumSearch,
  curriculumPublishedPlan,
} from "@/lib/api/sdk.gen";
import type { PlanLessonsOut, SearchHitOut } from "@/lib/api/types.gen";

export type { SearchHitOut };
import { withAuth } from "@/lib/session";

const BASE = "/reja/robototexnika";

/** Model thumbnail manzili (birinchi instruksiya qadami). */
export function rasmUrl(slug: string): string {
  return `${BASE}/rasm/${slug}.webp`;
}

export async function fetchRejaIndex(): Promise<RejaIndex> {
  const r = await fetch(`${BASE}/index.json`);
  if (!r.ok) throw new Error("index");
  return (await r.json()) as RejaIndex;
}

export async function fetchSinfReja(yil: string, sinf: string): Promise<SinfReja> {
  const r = await fetch(`${BASE}/${encodeURIComponent(yil)}/${encodeURIComponent(sinf)}.json`);
  if (!r.ok) throw new Error("sinf");
  return (await r.json()) as SinfReja;
}

// ─────────────── Joriy (DB) rejalar — oʻquv boʻlimi yuklaganlari ───────────────

/** fan → yil → sinf → darslar soni. */
export type PublishedCatalog = Record<string, Record<string, Record<string, number>>>;

export async function fetchPublishedCatalog(): Promise<PublishedCatalog> {
  const r = await withAuth<{ fanlar: PublishedCatalog }>(() =>
    curriculumPublishedCatalog(),
  );
  return r.fanlar;
}

/** DB'dagi joriy reja darslari — kartochka koʻrinishi shakliga keltiriladi. */
export async function fetchPublishedPlan(
  fan: string,
  yil: string,
  sinf: string,
): Promise<SinfReja> {
  const r = await withAuth<PlanLessonsOut>(() =>
    curriculumPublishedPlan({ query: { fan, yil, sinf } }),
  );
  return lessonsToChoraklar(yil, sinf, r.lessons as unknown as (Dars & { chorak?: number })[]);
}

/** Yassi darslar roʻyxatini chorak boʻlimlariga guruhlaydi. */
export function lessonsToChoraklar(
  yil: string,
  sinf: string,
  lessons: (Dars & { chorak?: number })[],
): SinfReja {
  const map = new Map<number, Dars[]>();
  for (const d of lessons) {
    const c = d.chorak && d.chorak >= 1 && d.chorak <= 4 ? d.chorak : 1;
    if (!map.has(c)) map.set(c, []);
    map.get(c)!.push(d);
  }
  const choraklar = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([c, darslar]) => ({ nom: `${c}-chorak`, darslar }));
  return { yil, sinf, choraklar };
}


/**
 * Metodik bazada qidiruv (MET-05).
 *
 * Qidiruv faqat JORIY rejalar boʻyicha — qoralama hali hujjat emas.
 * Natijada `matched_in` keladi: mavzu, atama yoki jihoz. Uni
 * koʻrsatish muhim — foydalanuvchi «nega bu chiqdi?» degan savolga
 * javob koʻrsin.
 */
export async function searchCurriculum(params: {
  q: string;
  fan?: string;
  sinf?: string;
  chorak?: number;
}): Promise<SearchHitOut[]> {
  return withAuth<SearchHitOut[]>(() =>
    curriculumSearch({
      query: {
        q: params.q,
        ...(params.fan ? { fan: params.fan } : {}),
        ...(params.sinf ? { sinf: params.sinf } : {}),
        ...(params.chorak ? { chorak: params.chorak } : {}),
      },
    }),
  );
}
