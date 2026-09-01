import { EmptyState } from "@/components/ui/EmptyState";
import { Header } from "@/components/ui/Header";

/**
 * Sinf reytingi — hozircha tayyorlanmoqda.
 *
 * Avval bu sahifa soxta sinfdoshlar roʻyxatini koʻrsatardi (audit Y12).
 * Reyting backend'i hali yozilmagan — haqiqiy baho yonida uydirma
 * reyting koʻrsatish oʻquvchini chalgʻitadi. Backend chiqqach sahifa
 * qaytariladi va nav roʻyxatiga qoʻshiladi.
 */
export default function RankingPage() {
  return (
    <>
      <Header title="Sinf reytingi" />
      <div className="p-4">
        <EmptyState
          title="Bu boʻlim tayyorlanmoqda"
          description="Reyting oʻquv yili davomida toʻplangan baho va davomat natijalari asosida chiqadi."
        />
      </div>
    </>
  );
}
