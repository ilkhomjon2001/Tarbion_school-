"use client";

/**
 * CRM — backend qatlami. Lidlar va qoʻngʻiroqlar `students.manage`
 * huquqi bilan, shartnomalar roʻyxati moliya koʻrinishi bilan yopiq —
 * tekshiruvlar SERVERDA (7-qoida).
 */

import {
  crmAddCall,
  crmArchiveLead,
  crmCalls,
  crmContracts,
  crmCreateLead,
  crmLeadCalls,
  crmLeads,
  crmLeadsSummary,
  crmUpdateLead,
} from "@/lib/api/sdk.gen";
import type {
  CallFeedOut,
  CrmContractOut,
  LeadCallOut,
  LeadOut,
  LeadSummaryOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { CallFeedOut, CrmContractOut, LeadCallOut, LeadOut, LeadSummaryOut };

export const STATUS_LABELS: Record<string, string> = {
  yangi: "Yangi",
  aloqada: "Aloqada",
  tashrif: "Tashrif",
  qabul_qilindi: "Qabul qilindi",
  yo_qoldi: "Yoʻqoldi",
};

/** Yakuniy holatlar — bulardan qaytish yoʻq (serverda 409). */
export const CLOSED_STATUSES = new Set(["qabul_qilindi", "yo_qoldi"]);

export const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  telegram: "Telegram",
  tavsiya: "Tavsiya",
  sayt: "Sayt",
  boshqa: "Boshqa",
};

export const RESULT_LABELS: Record<string, string> = {
  javob_berdi: "Javob berdi",
  kotarilmadi: "Koʻtarilmadi",
  band: "Band",
  keyin_qaytaraman: "Keyin qaytaraman",
};

const datetimeFormatter = new Intl.DateTimeFormat("uz-Latn", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tashkent",
});

/** UTC ISO vaqtni Toshkent boʻyicha «2-sen, 14:30» koʻrinishida beradi. */
export function formatCallTime(iso: string): string {
  return datetimeFormatter.format(new Date(iso));
}

export async function fetchLeads(params?: {
  status?: string;
  q?: string;
}): Promise<LeadOut[]> {
  return withAuth<LeadOut[]>(() =>
    crmLeads({
      query: {
        status: params?.status || null,
        q: params?.q || null,
      },
    }),
  );
}

export async function fetchLeadSummary(): Promise<LeadSummaryOut> {
  return withAuth<LeadSummaryOut>(() => crmLeadsSummary({}));
}

export type LeadInput = {
  parent_name: string;
  phone: string;
  child_name?: string | null;
  child_birth_year?: number | null;
  source: string;
  note?: string | null;
};

export async function createLead(input: LeadInput): Promise<LeadOut> {
  return withAuth<LeadOut>(() => crmCreateLead({ body: input }));
}

export type LeadPatch = {
  parent_name?: string;
  phone?: string;
  child_name?: string | null;
  child_birth_year?: number | null;
  source?: string;
  status?: string;
  note?: string | null;
  student_id?: string | null;
};

export async function updateLead(id: string, patch: LeadPatch): Promise<LeadOut> {
  return withAuth<LeadOut>(() => crmUpdateLead({ path: { lead_id: id }, body: patch }));
}

export async function archiveLead(id: string): Promise<void> {
  await withAuth(() => crmArchiveLead({ path: { lead_id: id } }));
}

export async function fetchLeadCalls(leadId: string): Promise<LeadCallOut[]> {
  return withAuth<LeadCallOut[]>(() => crmLeadCalls({ path: { lead_id: leadId } }));
}

export async function addCall(
  leadId: string,
  input: { result: string; note?: string | null },
): Promise<LeadCallOut> {
  return withAuth<LeadCallOut>(() =>
    crmAddCall({ path: { lead_id: leadId }, body: input }),
  );
}

export async function fetchRecentCalls(limit = 100): Promise<CallFeedOut[]> {
  return withAuth<CallFeedOut[]>(() => crmCalls({ query: { limit } }));
}

export async function fetchContracts(q?: string): Promise<CrmContractOut[]> {
  return withAuth<CrmContractOut[]>(() => crmContracts({ query: { q: q || null } }));
}
