import { StudentsBoard } from "@/components/admin/StudentsBoard";

export const metadata = { title: "Oʻquvchilar — Tarbion administrator" };

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <StudentsBoard initialQuery={q ?? ""} />;
}
