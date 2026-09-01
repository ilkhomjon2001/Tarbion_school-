"use client";

/**
 * Oʻquvchi kabineti qobigʻi — yon menyu, tepa panel, pastki navigatsiya.
 *
 * Ilgari layout serverda mock oʻquvchini olib berardi. Endi ism va sinf
 * SESSIYADAN keladi (`/auth/me` → AuthGuard tiklaydi) — bu komponent
 * AuthGuard ichida chizilgani uchun foydalanuvchi doim mavjud.
 *
 * Qidiruv indeksi hozircha faqat sahifalardan iborat: uy vazifasi va
 * testlar roʻyxatini har sahifa ochilishida oldindan yuklash qimmat,
 * ular oʻz sahifalarida qidiriladi.
 */

import { BottomNav } from "@/components/ui/BottomNav";
import { MobileTopBar } from "@/components/ui/MobileTopBar";
import { Sidebar } from "@/components/ui/Sidebar";
import { Topbar } from "@/components/ui/Topbar";
import { getUser } from "@/lib/session";
import { buildSearchIndex } from "@/lib/search";
import type { Student } from "@/lib/types";

export function StudentChrome({ children }: { children: React.ReactNode }) {
  const user = getUser();
  const student: Student = {
    id: user?.student_id ?? "",
    fullName: user?.full_name ?? "",
    className: user?.class_name ?? "—",
  };
  const searchIndex = buildSearchIndex({ homework: [], tests: [], announcements: [] });

  return (
    <div className="min-h-full bg-background">
      <Sidebar student={student} />
      <div className="flex min-h-full flex-col md:pl-64">
        <MobileTopBar student={student} searchIndex={searchIndex} />
        <Topbar student={student} searchIndex={searchIndex} />
        <div className="mx-auto w-full max-w-5xl flex-1 pb-20 md:pb-8">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}
