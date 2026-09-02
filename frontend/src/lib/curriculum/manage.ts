"use client";

/**
 * Metodik baza BOSHQARUVI (oʻquv boʻlimi) — import/eksport/joriy qilish.
 *
 * Fayl yuklab olishlar (shablon, eksport) sdk orqali emas, toʻgʻridan
 * fetch bilan: javob binary (xlsx) va brauzerda blob sifatida saqlanadi.
 */

import {
  curriculumArchive,
  curriculumImportPlan,
  curriculumPlanLessons,
  curriculumPlans,
  curriculumPublish,
} from "@/lib/api/sdk.gen";
import type { PlanLessonsOut, PlanRowOut } from "@/lib/api/types.gen";
import { getToken, withAuth } from "@/lib/session";

export type { PlanLessonsOut, PlanRowOut };

export const STATUS_LABELS: Record<string, string> = {
  qoralama: "Qoralama",
  joriy: "Joriy",
  arxiv: "Arxiv",
};

export const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  joriy: "success",
  qoralama: "warning",
  arxiv: "neutral",
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchPlans(): Promise<PlanRowOut[]> {
  return withAuth<PlanRowOut[]>(() => curriculumPlans());
}

export async function fetchPlanLessons(planId: string): Promise<PlanLessonsOut> {
  return withAuth<PlanLessonsOut>(() =>
    curriculumPlanLessons({ path: { plan_id: planId } }),
  );
}

export async function importPlan(input: {
  fan: string;
  yil: string;
  sinf: string;
  file: File;
}): Promise<{ plan: PlanRowOut; warnings: string[] }> {
  return withAuth(() =>
    curriculumImportPlan({
      body: {
        fan: input.fan,
        yil: input.yil,
        sinf: input.sinf,
        file: input.file,
      },
    }),
  );
}

export async function publishPlan(planId: string): Promise<PlanRowOut> {
  return withAuth<PlanRowOut>(() =>
    curriculumPublish({ path: { plan_id: planId } }),
  );
}

export async function archivePlan(planId: string): Promise<void> {
  await withAuth(() => curriculumArchive({ path: { plan_id: planId } }));
}

/** Binary faylni yuklab olib, brauzerda saqlash oynasini ochadi. */
async function downloadBlob(path: string, filename: string): Promise<void> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!r.ok) throw new Error("yuklab olinmadi");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTemplate(): Promise<void> {
  return downloadBlob("/api/v1/curriculum/template", "reja-shablon.xlsx");
}

export function downloadExport(plan: PlanRowOut): Promise<void> {
  const nom = `${plan.fan}-${plan.yil}-${plan.sinf}.xlsx`.replaceAll(" ", "_");
  return downloadBlob(`/api/v1/curriculum/plans/${plan.id}/export`, nom);
}
