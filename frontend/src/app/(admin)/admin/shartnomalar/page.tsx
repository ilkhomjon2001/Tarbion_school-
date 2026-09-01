import { EmptyState } from "@/components/ui/EmptyState";
import { ShieldIcon } from "@/components/ui/icons";

export const metadata = { title: "Shartnomalar — Tarbion administrator" };

/**
 * Shartnomalar (CRM) — backend'da hali yoʻq.
 *
 * Avval bu sahifada brauzer xotirasidagi demo maʼlumot turardi; u
 * haqiqiy roʻyxat degan taassurot uygʻotardi. Modul serverga ulangunga
 * qadar halol boʻsh holat koʻrsatiladi.
 */
export default function AdminContractsPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-h2 font-bold text-foreground">Shartnomalar</h1>
      </div>
      <EmptyState
        icon={<ShieldIcon className="h-5 w-5" />}
        title="Bu boʻlim serverga hali ulanmagan"
        description="Shartnomalar harakati boʻyicha hisobot toʻlov moduli kengaygach ochiladi; oylik summa hozircha oʻquvchi kartochkasida («Toʻlovlar» boʻlimi) belgilanadi. Maʼlumotlar keyingi bosqichda kiritiladi."
      />
    </div>
  );
}
