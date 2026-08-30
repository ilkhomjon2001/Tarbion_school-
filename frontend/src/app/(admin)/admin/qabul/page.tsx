import { EnrollWizard } from "@/components/admin/EnrollWizard";

export const metadata = { title: "Qabul — Tarbion administrator" };

export default async function AdminEnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ yangi?: string; lid?: string }>;
}) {
  const { yangi, lid } = await searchParams;
  // `lid` — lidlar boʻlimidan kelgan: forma oldindan toʻldiriladi.
  return <EnrollWizard startBlank={yangi === "1" || Boolean(lid)} fromLeadId={lid} />;
}
