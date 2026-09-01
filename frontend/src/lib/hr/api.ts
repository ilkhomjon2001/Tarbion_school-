"use client";

/**
 * Kadrlar — backend qatlami. Butun modul `users.manage` bilan yopiq:
 * oylik shu javobda bor, shuning uchun ustozga ham 403.
 */

import {
  hrAddLeave,
  hrArchiveLeave,
  hrEmployees,
  hrLeaves,
  hrUpdateProfile,
} from "@/lib/api/sdk.gen";
import type { EmployeeOut, LeaveOut } from "@/lib/api/types.gen";
import { withAuth } from "@/lib/session";

export type { EmployeeOut, LeaveOut };

export const CONTRACT_LABELS: Record<string, string> = {
  toliq: "Toʻliq stavka",
  yarim: "Yarim stavka",
  soatbay: "Soatbay",
};

export const QUALIFICATION_LABELS: Record<string, string> = {
  oliy: "Oliy toifa",
  birinchi: "1-toifa",
  ikkinchi: "2-toifa",
  toifasiz: "Toifasiz",
};

export const LEAVE_LABELS: Record<string, string> = {
  tatil: "Mehnat taʼtili",
  kasallik: "Kasallik varaqasi",
  "oz-hisobidan": "Oʻz hisobidan",
  malaka: "Malaka oshirish",
};

export async function fetchEmployees(): Promise<EmployeeOut[]> {
  return withAuth<EmployeeOut[]>(() => hrEmployees({}));
}

export type ProfileInput = {
  position: string;
  contract_type: string;
  qualification: string;
  hired_on: string | null;
  base_salary: number | null;
  note?: string | null;
};

/** Oylik oʻzgarsa serverda audit yoziladi. */
export async function updateProfile(
  userId: string,
  input: ProfileInput,
): Promise<EmployeeOut> {
  return withAuth<EmployeeOut>(() =>
    hrUpdateProfile({ path: { user_id: userId }, body: input }),
  );
}

export async function fetchLeaves(): Promise<LeaveOut[]> {
  return withAuth<LeaveOut[]>(() => hrLeaves({}));
}

export async function addLeave(input: {
  user_id: string;
  leave_type: string;
  starts_on: string;
  ends_on: string;
  note?: string | null;
}): Promise<LeaveOut> {
  return withAuth<LeaveOut>(() => hrAddLeave({ body: input }));
}

export async function archiveLeave(id: string): Promise<void> {
  await withAuth(() => hrArchiveLeave({ path: { leave_id: id } }));
}
