"use client";

/**
 * Kirish huquqlari — serverdan (T-005).
 *
 * Frontend menyuni OʻZI HISOBLAMAYDI. `/auth/me` javobidagi `sections`
 * va `permissions` roʻyxatlari ishlatiladi. Sabab: agar frontend ham
 * hisoblasa, ikkisi farq qilib qolardi va odam koʻrgan tugmasini
 * bosganda `403` olardi.
 *
 * `lib/access.ts` dagi eski mock model faqat super administrator
 * ekranida "qaysi boʻlim bor" roʻyxatini chizish uchun qoldi — u
 * reyestr, huquq emas.
 *
 * MUHIM: bu qatlam HIMOYA EMAS (CLAUDE.md 7-qoida). Boʻlimni yashirish
 * — qulaylik; har bir soʻrovni server qaytadan tekshiradi.
 */

import { useEffect, useState } from "react";

import {
  accessPermissionRegistry,
  accessSections,
  accessSetPermissions,
  accessSetSections,
  accessUserAccess,
  accessUsers,
} from "@/lib/api/sdk.gen";
import type {
  PermissionOut,
  SectionOut,
  UserAccessOut,
  UserOut,
} from "@/lib/api/types.gen";
import { getUser, restore, withAuth } from "@/lib/session";

export type { PermissionOut, SectionOut, UserAccessOut };

/**
 * Joriy foydalanuvchining boʻlim va huquqlari.
 *
 * Sahifa yangilanganda token xotiradan yoʻqoladi, shuning uchun
 * `restore()` chaqiriladi — u refresh cookie orqali sessiyani tiklaydi
 * va `/auth/me` javobini qaytaradi.
 */
export function useAccess(): {
  user: UserOut | null;
  sections: string[];
  permissions: string[];
  canSee: (sectionId: string) => boolean;
  can: (permission: string) => boolean;
  loading: boolean;
} {
  const [user, setUser] = useState<UserOut | null>(getUser());
  const [loading, setLoading] = useState(user === null);

  useEffect(() => {
    if (user !== null) return;
    let alive = true;

    restore()
      .then(() => alive && setUser(getUser()))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [user]);

  const sections = user?.sections ?? [];
  const permissions = user?.permissions ?? [];

  return {
    user,
    sections,
    permissions,
    canSee: (id) => sections.includes(id),
    can: (p) => permissions.includes(p),
    loading,
  };
}

// ─────────────────────── Super administrator ekrani ───────────────────────

export async function fetchSections(): Promise<SectionOut[]> {
  return withAuth<SectionOut[]>(() => accessSections());
}

export async function fetchPermissionRegistry(): Promise<PermissionOut[]> {
  return withAuth<PermissionOut[]>(() => accessPermissionRegistry());
}

export async function fetchUsers(query?: string): Promise<UserAccessOut[]> {
  return withAuth<UserAccessOut[]>(() =>
    accessUsers({ query: query ? { q: query } : undefined }),
  );
}

export async function fetchUserAccess(userId: string): Promise<UserAccessOut> {
  return withAuth<UserAccessOut>(() =>
    accessUserAccess({ path: { user_id: userId } }),
  );
}

/** `sections: null` — istisnoni bekor qilib rol standartiga qaytaradi. */
export async function saveSections(
  userId: string,
  sections: string[] | null,
): Promise<UserAccessOut> {
  return withAuth<UserAccessOut>(() =>
    accessSetSections({ path: { user_id: userId }, body: { sections } }),
  );
}

/** Toʻliq roʻyxat yuboriladi — qoʻshish/olib tashlash emas. */
export async function savePermissions(
  userId: string,
  permissions: string[],
): Promise<UserAccessOut> {
  return withAuth<UserAccessOut>(() =>
    accessSetPermissions({ path: { user_id: userId }, body: { permissions } }),
  );
}
