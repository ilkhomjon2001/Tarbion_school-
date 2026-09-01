import { LiveTeacherTable } from "@/components/director/LiveTeacherTable";

export const metadata = { title: "Ustozlar — Tarbion rahbariyat" };

export default function TeachersPage() {
  return (
    <div className="p-4 md:p-6">
      <LiveTeacherTable />
    </div>
  );
}
