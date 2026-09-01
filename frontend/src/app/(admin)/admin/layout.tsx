import { AdminMobileTopBar, AdminSidebar, AdminTopbar } from "@/components/admin/AdminShell";
import { AuthGuard } from "@/components/auth/AuthGuard";

/**
 * Administrator kabineti.
 *
 * Har bir sahifa maʼlumotni oʻzi serverdan oladi — umumiy mijoz holati
 * (eski `AdminProvider` mock doʻkoni) olib tashlangan.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="admin">
      <div className="min-h-full bg-background">
        <AdminSidebar />
        <div className="flex min-h-full flex-col md:pl-64">
          <AdminMobileTopBar />
          <AdminTopbar />
          <div className="mx-auto w-full max-w-6xl flex-1 pb-10">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}
