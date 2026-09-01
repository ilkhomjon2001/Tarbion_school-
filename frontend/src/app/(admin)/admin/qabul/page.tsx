import { EnrollWizard } from "@/components/admin/EnrollWizard";

export const metadata = { title: "Qabul — Tarbion administrator" };

export default async function AdminEnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ yangi?: string }>;
}) {
  const { yangi } = await searchParams;
  return <EnrollWizard startBlank={yangi === "1"} />;
}
