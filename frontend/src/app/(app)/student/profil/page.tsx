import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { Header } from "@/components/ui/Header";
import { Skeleton } from "@/components/ui/Skeleton";
import { ContactInfoForm } from "@/components/features/student/ContactInfoForm";
import { PasswordChangeForm } from "@/components/features/student/PasswordChangeForm";
import { NotificationPreferencesForm } from "@/components/features/student/NotificationPreferencesForm";
import { getCurrentStudent, getNotificationPreferences } from "@/lib/mock/fetchers";

export default function ProfilePage() {
  return (
    <>
      <Header title="Profil" />
      <div className="flex flex-col gap-4 p-4">
        <Suspense fallback={<Card className="h-20 animate-pulse" />}>
          <ProfileHeader />
        </Suspense>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Aloqa maʼlumotlari</h2>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <ContactSection />
          </Suspense>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Parolni oʻzgartirish</h2>
          <Card>
            <PasswordChangeForm />
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Bildirishnoma sozlamalari
          </h2>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <NotificationSection />
          </Suspense>
        </section>
      </div>
    </>
  );
}

async function ProfileHeader() {
  const student = await getCurrentStudent();
  return (
    <Card className="flex items-center gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground">
        {initials(student.fullName)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-foreground">{student.fullName}</p>
        <p className="text-sm text-foreground-muted">{student.className} sinf</p>
      </div>
    </Card>
  );
}

async function ContactSection() {
  const student = await getCurrentStudent();
  return (
    <Card>
      <ContactInfoForm student={student} />
    </Card>
  );
}

async function NotificationSection() {
  const prefs = await getNotificationPreferences();
  return <NotificationPreferencesForm initial={prefs} />;
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
