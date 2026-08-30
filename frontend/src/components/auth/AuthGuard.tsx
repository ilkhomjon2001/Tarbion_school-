"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { currentRole, isAuthenticated } from "@/lib/auth";
import { ROLE_HOME, type UserRole } from "@/lib/roles";

/**
 * DEMO kirish tekshiruvi.
 *
 * Ikki holatni ushlaydi:
 *   – sessiya yoʻq → /login;
 *   – sessiya bor, lekin rol boshqa kabinetniki → oʻz kabinetiga qaytaradi
 *     (oʻquvchi /admin manzilini qoʻlda yozsa — /student ga tushadi).
 *
 * Bu haqiqiy himoya EMAS (CLAUDE.md 7-qoida: rol tekshiruvi har doim
 * serverda). Backend/JWT ulanmaguncha faqat toʻgʻri xatti-harakatni
 * frontendda koʻrsatib turadi.
 */
export function AuthGuard({
  children,
  role,
}: {
  children: React.ReactNode;
  /** Shu kabinet qaysi rolga tegishli. Berilmasa — faqat sessiya tekshiriladi. */
  role?: UserRole;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const actual = currentRole();
    // `actual === null` — eski sessiya, rol saqlanmagan: qulflab
    // qoʻymaymiz, sessiya bor ekan kiritamiz.
    if (role && actual && actual !== role) {
      router.replace(ROLE_HOME[actual]);
      return;
    }
    setReady(true);
  }, [router, role]);

  if (!ready) return null;
  return <>{children}</>;
}
