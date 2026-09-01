"use client";

/**
 * Toʻlov moduli — backend qatlami (TOL-01…TOL-07, OTA-06).
 *
 * Kirish doiralari SERVERDA: administrator/direktor hammasini, ota-ona
 * faqat oʻz farzandini koʻradi, oʻquv boʻlimiga umuman yopiq. Yozish
 * `payments.manage` huquqi bilan.
 *
 * Onlayn toʻlov hozircha SINOV provayderi orqali — haqiqiy pul
 * harakati YOʻQ. Payme/Click kelganda faqat kalit va URL almashadi.
 */

import {
  paymentsAddDiscount,
  paymentsArchiveDiscount,
  paymentsCreateIntent,
  paymentsGenerateCharges,
  paymentsGetIntent,
  paymentsRecordPayment,
  paymentsSetContract,
  paymentsSinovComplete,
  paymentsStorno,
  paymentsStudentLedger,
  paymentsStudents,
  paymentsSummary,
} from "@/lib/api/sdk.gen";
import type {
  FinanceSummaryOut,
  IntentOut,
  StudentFinanceOut,
  StudentLedgerOut,
} from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { FinanceSummaryOut, IntentOut, StudentFinanceOut, StudentLedgerOut };

export const DEFAULT_MONTHLY_FEE = 3_500_000;

export const METHOD_LABELS: Record<string, string> = {
  naqd: "Naqd",
  otkazma: "Bank oʻtkazmasi",
  terminal: "Terminal",
  onlayn: "Onlayn",
};

export async function fetchFinanceSummary(): Promise<FinanceSummaryOut> {
  return withAuth<FinanceSummaryOut>(() => paymentsSummary({}));
}

export async function fetchFinanceStudents(
  debtorsOnly = false,
): Promise<StudentFinanceOut[]> {
  return withAuth<StudentFinanceOut[]>(() =>
    paymentsStudents({ query: { debtors: debtorsOnly } }),
  );
}

export async function fetchLedger(studentId: string): Promise<StudentLedgerOut> {
  return withAuth<StudentLedgerOut>(() =>
    paymentsStudentLedger({ path: { student_id: studentId } }),
  );
}

export async function setContract(
  studentId: string,
  monthlyFee: number,
  startsOn: string,
  note?: string,
): Promise<StudentLedgerOut> {
  return withAuth<StudentLedgerOut>(() =>
    paymentsSetContract({
      path: { student_id: studentId },
      body: { monthly_fee: monthlyFee, starts_on: startsOn, note: note ?? null },
    }),
  );
}

export async function addDiscount(
  studentId: string,
  input: {
    kind: string;
    value: number;
    reason: string;
    starts_on: string;
    ends_on?: string | null;
  },
): Promise<StudentLedgerOut> {
  return withAuth<StudentLedgerOut>(() =>
    paymentsAddDiscount({ path: { student_id: studentId }, body: input }),
  );
}

export async function archiveDiscount(discountId: string): Promise<void> {
  await withAuth(() => paymentsArchiveDiscount({ path: { discount_id: discountId } }));
}

/** Oylik qarzni yozish — idempotent. Nechta yozilganini qaytaradi. */
export async function generateCharges(year: number, month: number): Promise<number> {
  const r = await withAuth<Record<string, number>>(() =>
    paymentsGenerateCharges({ body: { year, month } }),
  );
  return r.created ?? 0;
}

export async function recordPayment(input: {
  student_id: string;
  amount: number;
  method: string;
  paid_on?: string | null;
  receipt_no?: string | null;
  note?: string | null;
}): Promise<StudentLedgerOut> {
  return withAuth<StudentLedgerOut>(() => paymentsRecordPayment({ body: input }));
}

/** TOL-07: tahrirlash yoʻq — storno, sabab bilan. */
export async function stornoPayment(
  paymentId: string,
  reason: string,
): Promise<StudentLedgerOut> {
  return withAuth<StudentLedgerOut>(() =>
    paymentsStorno({ path: { payment_id: paymentId }, body: { reason } }),
  );
}

// ─────────────────── Onlayn (sinov) ───────────────────

export async function createIntent(
  studentId: string,
  amount: number,
): Promise<IntentOut> {
  return withAuth<IntentOut>(() =>
    paymentsCreateIntent({ body: { student_id: studentId, amount } }),
  );
}

export async function completeSinov(
  intentId: string,
  outcome: "paid" | "cancelled",
): Promise<IntentOut> {
  return withAuth<IntentOut>(() =>
    paymentsSinovComplete({ path: { intent_id: intentId }, body: { outcome } }),
  );
}

export async function fetchIntent(intentId: string): Promise<IntentOut> {
  return withAuth<IntentOut>(() => paymentsGetIntent({ path: { intent_id: intentId } }));
}
