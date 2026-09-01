"use client";

import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { ContactInfoForm } from "@/components/features/student/ContactInfoForm";
import { DeviceSecurity } from "@/components/features/student/DeviceSecurity";
import { LogoutButton } from "@/components/features/student/LogoutButton";
import { PasswordChangeForm } from "@/components/features/student/PasswordChangeForm";
import { NotificationPreferencesForm } from "@/components/features/student/NotificationPreferencesForm";
import { getUser } from "@/lib/session";
import type { Student } from "@/lib/types";

/**
 * Profil. Ism va sinf SESSIYADAN (T-034), parol almashtirish BAZAGA yozadi.
 *
 * «Faol qurilmalar» va bildirishnoma sozlamalari hali demo:
 * `/auth/sessions` (T-004) va `notification_preferences` (T-018)
 * backend'da yozilgach ulanadi.
 */
export default function ProfilePage() {
  const user = getUser();
  const student: Student = {
    id: user?.student_id ?? "",
    fullName: user?.full_name ?? "",
    className: user?.class_name ?? "—",
  };

  return (
    <>
      <Header title="Profil" />
      <div className="flex flex-col gap-4 p-4">
        <Card className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground">
            {initials(student.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {student.fullName}
            </p>
            <p className="text-sm text-foreground-muted">{student.className} sinf</p>
          </div>
        </Card>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Aloqa maʼlumotlari</h2>
          <Card>
            <ContactInfoForm student={student} />
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Parolni oʻzgartirish</h2>
          <Card>
            <PasswordChangeForm />
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Faol qurilmalar</h2>
          <Card>
            <DeviceSecurity />
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Bildirishnoma sozlamalari
          </h2>
          <NotificationPreferencesForm
            initial={{ newGrade: true, homeworkReminder: true, announcements: true }}
          />
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
