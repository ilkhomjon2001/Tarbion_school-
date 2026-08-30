import { AuthGuard } from "@/components/auth/AuthGuard";

/** Ota-ona kabineti — kirish tekshiruvi. */
export default function ParentRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard role="parent">{children}</AuthGuard>;
}
