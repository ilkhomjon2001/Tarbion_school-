import { notFound } from "next/navigation";
import { Header } from "@/components/ui/Header";
import { TestRunner } from "@/components/features/student/TestRunner";
import { getTestById } from "@/lib/mock/fetchers";

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const test = await getTestById(id);

  if (!test) {
    notFound();
  }

  return (
    <>
      <Header title={test.title} backHref="/student/tests" />
      <div className="p-4">
        <TestRunner test={test} />
      </div>
    </>
  );
}
