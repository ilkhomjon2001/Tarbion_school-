import { EmptyState } from "@/components/ui/EmptyState";
import { PhoneIcon } from "@/components/ui/icons";

export const metadata = { title: "Qoʻngʻiroqlar — Tarbion administrator" };

/**
 * Qoʻngʻiroqlar (CRM) — backend'da hali yoʻq.
 *
 * Avval bu sahifada brauzer xotirasidagi demo maʼlumot turardi; u
 * haqiqiy roʻyxat degan taassurot uygʻotardi. Modul serverga ulangunga
 * qadar halol boʻsh holat koʻrsatiladi.
 */
export default function AdminCallsPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-h2 font-bold text-foreground">Qoʻngʻiroqlar</h1>
      </div>
      <EmptyState
        icon={<PhoneIcon className="h-5 w-5" />}
        title="Bu boʻlim serverga hali ulanmagan"
        description="Qoʻngʻiroqlar jurnali CRM moduli bilan birga keladi. Maʼlumotlar keyingi bosqichda kiritiladi."
      />
    </div>
  );
}
