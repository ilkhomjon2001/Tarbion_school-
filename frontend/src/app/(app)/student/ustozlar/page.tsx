import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";

/**
 * Ustozlar roʻyxati — hozircha tayyorlanmoqda.
 *
 * Avval bu sahifa kodga yozib qoʻyilgan soxta ustozlar roʻyxatini
 * koʻrsatardi (audit Y12). Oʻquvchiga moʻljallangan ustozlar endpoint'i
 * hali yoʻq — u yozilgach sahifa real jadval asosida qaytariladi va nav
 * roʻyxatiga qoʻshiladi. Ungacha ustoz ismlari dars jadvalida koʻrinadi.
 */
export default function StudentTeachersPage() {
  return (
    <>
      <Header title="Ustozlar" />
      <div className="p-4">
        <EmptyState
          title="Bu boʻlim tayyorlanmoqda"
          description="Fan oʻqituvchilaringiz roʻyxati tez orada shu yerda chiqadi. Hozircha ustoz ismlarini dars jadvalidan koʻrishingiz mumkin."
        />
      </div>
    </>
  );
}
