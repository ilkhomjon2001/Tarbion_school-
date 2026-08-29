import { Header } from "@/components/ui/Header";
import { ErrorState } from "@/components/ui/ErrorState";

export default function StudentNotFound() {
  return (
    <>
      <Header title="Topilmadi" backHref="/student" />
      <div className="p-4">
        <ErrorState
          title="Maʼlumot topilmadi"
          description="Bu havola eskirgan yoki notoʻgʻri boʻlishi mumkin."
        />
      </div>
    </>
  );
}
