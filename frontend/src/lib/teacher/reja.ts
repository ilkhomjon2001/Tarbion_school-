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
