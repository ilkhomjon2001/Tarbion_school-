import { AdminMobileTopBar, AdminSidebar, AdminTopbar } from "@/components/admin/AdminShell";
import { AdminProvider } from "@/lib/admin/store";

/**
 * Administrator kabineti.
 *
 * Boshqa kabinetlardan farqi: bu yerdagi sahifalar mijoz komponentlari va
 * umumiy `AdminProvider` holatidan oʻqiydi. Sabab — admin maʼlumot
 * KIRITADI, kiritgani esa boshqa boʻlimlarda darhol koʻrinishi kerak
 * (toʻlov kiritildi → qarzdorlar roʻyxatidan chiqdi → audit jurnaliga
 * tushdi). Backend ulanganda provider TanStack Query bilan almashtiriladi.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <div className="min-h-full bg-background">
        <AdminSidebar />
        <div className="flex min-h-full flex-col md:pl-64">
          <AdminMobileTopBar />
          <AdminTopbar />
          <div className="mx-auto w-full max-w-6xl flex-1 pb-10">{children}</div>
        </div>
      </div>
    </AdminProvider>
  );
}
