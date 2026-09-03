/**
 * Xabar shablonlari klienti (T-019, BOT-05).
 *
 * Sukut matnlar backendda; bu yerdan faqat ustama yoziladi va
 * «sukutga qaytarish» soʻraladi.
 */

import {
  templatesListTemplates,
  templatesResetTemplate,
  templatesSetTemplate,
} from "@/lib/api/sdk.gen";
import type { TemplateOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { TemplateOut };

export async function fetchTemplates(): Promise<TemplateOut[]> {
  return withAuth<TemplateOut[]>(() => templatesListTemplates({}));
}

export async function saveTemplate(
  kind: string,
  title: string,
  body: string,
): Promise<TemplateOut> {
  return withAuth<TemplateOut>(() =>
    templatesSetTemplate({ path: { kind }, body: { title, body } }),
  );
}

export async function resetTemplate(kind: string): Promise<TemplateOut> {
  return withAuth<TemplateOut>(() => templatesResetTemplate({ path: { kind } }));
}
