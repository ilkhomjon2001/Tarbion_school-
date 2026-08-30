import { DocumentsBoard } from "@/components/admin/DocumentsBoard";

export const metadata = { title: "Maʼlumotnomalar — Tarbion administrator" };

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student } = await searchParams;
  return <DocumentsBoard preselectStudent={student ?? ""} />;
}
