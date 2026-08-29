"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";

/**
 * DEMO kirish tekshiruvi — login sahifasidan tashqarida sessiya yoʻq boʻlsa
 * /login ga qaytaradi. Bu haqiqiy himoya EMAS (CLAUDE.md 7-qoida: rol
 * tekshiruvi har doim serverda boʻlishi kerak) — backend/JWT ulanmaguncha
 * faqat "eslab qolish" UX'ini frontendda koʻrsatib turadi.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
