"use client";

import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { LogoutButton } from "@/components/features/student/LogoutButton";
import { PasswordChangeForm } from "@/components/features/student/PasswordChangeForm";
import { getUser } from "@/lib/session";

/**
 * Profil. Ism, login va sinf SESSIYADAN (`/auth/me`), parol
 * almashtirish BAZAGA yozadi.
 *
 * "Faol qurilmalar", kontakt va bildirishnoma formalari OLIB TASHLANDI
 * (audit K7, K8): ular hech qanday backendga ulanmagan edi — "Saqlandi"
 * degani bilan hech narsa saqlanmasdi, soxta qurilma roʻyxati esa
 * xavfsizlik yolgʻoni edi. Backend (T-004 sessiyalar, T-018
 * bildirishnomalar) yozilgach qaytariladi.
 */
export default function ProfilePage() {
  const user = getUser();
  const fullName = user?.full_name ?? "";
  const className = user?.class_name ?? "—";
  const login = user?.login ?? "";

  return (
    <>
      <Header title="Profil" />
      <div className="flex flex-col gap-4 p-4">
        <Card className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground">
            {initials(fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {fullName}
            </p>
            <p className="text-sm text-foreground-muted">
              {className} sinf · Oʻquvchi
            </p>
            {login && (
              <p className="text-xs text-foreground-muted">Login: {login}</p>
            )}
          </div>
        </Card>

        <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-foreground-muted">
          Telefon raqami yoki boshqa kontakt maʼlumotlarini oʻzgartirish
          uchun maktab administratsiyasiga murojaat qiling.
        </p>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Parolni oʻzgartirish
          </h2>
          <Card>
            <PasswordChangeForm />
          </Card>
        </section>

        <section>
          <LogoutButton />
        </section>
      </div>
    </>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
