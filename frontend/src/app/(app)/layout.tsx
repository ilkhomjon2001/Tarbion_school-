import { AuthGuard } from "@/components/auth/AuthGuard";
import { StudentChrome } from "@/components/features/student/StudentChrome";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="student">
      <StudentChrome>{children}</StudentChrome>
    </AuthGuard>
  );
}
