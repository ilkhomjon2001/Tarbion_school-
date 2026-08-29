import { BottomNav } from "@/components/ui/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col bg-background">
      <div className="flex-1 pb-20">{children}</div>
      <BottomNav />
    </div>
  );
}
