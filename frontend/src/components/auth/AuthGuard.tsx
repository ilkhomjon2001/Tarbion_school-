"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { currentRole, restore } from "@/lib/auth";
import { ROLE_CABINET, ROLE_HOME, type UserRole } from "@/lib/roles";
import { getUser, isAuthenticated } from "@/lib/session";

/**
 * Kirish tekshiruvi.
 *
 * Access token XOTIRADA saqlanadi, shuning uchun sahifa yangilanganda
 * yoʻqoladi. `restore()` httpOnly refresh cookie'si orqali yangi token
 * oladi — foydalanuvchi har F5 da qayta kirmaydi.
 *
 * Uch holat ushlanadi:
 *   – sessiya yoʻq → `/login`
 *   – parol almashtirilmagan → `/parol` (5 xonali boshlangʻich parol
 *     doimiy qolib ketmasin)
 *   – rol boshqa kabinetniki → oʻz kabinetiga
 *
 * Bu HIMOYA EMAS (CLAUDE.md 7-qoida): har bir soʻrovni backend
 * qaytadan tekshiradi. Bu yerdagi tekshiruv — foydalanuvchi boshi
 * berk koʻchaga kirib qolmasligi uchun.
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
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Xotiradagi token yoʻq boʻlsa cookie orqali tiklaymiz.
      const ok = isAuthenticated() || (await restore());
      if (!alive) return;

      if (!ok) {
        router.replace("/login");
        return;
      }

      // Boshlangʻich parol hali almashtirilmagan — boshqa hech qayerga
      // oʻtkazmaymiz. `/parol` sahifasining oʻzi bundan mustasno.
      if (getUser()?.must_change_password && pathname !== "/parol") {
        router.replace("/parol");
        return;
      }

      const actual = currentRole();
      if (role && actual && ROLE_CABINET[actual] !== ROLE_CABINET[role]) {
        router.replace(ROLE_HOME[actual]);
        return;
      }

      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [router, role, pathname]);

  if (!ready) return null;
  return <>{children}</>;
}
