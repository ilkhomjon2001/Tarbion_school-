import type { Metadata, Viewport } from "next";
import { Inter, Onest } from "next/font/google";
import "./globals.css";

/**
 * Shriftlar.
 *
 * Body — Inter, sarlavha — Onest. Ikkalasi ham `ʻ` (U+02BB, oʻzbek
 * apostrofi) glifiga ega: font fayllarining cmap jadvali tekshirilgan.
 * Bu tekshiruv shart, chunki Google Fonts `latin` subsetida U+02BB ni
 * eʼlon qiladi, lekin ayrim shriftlarda (Manrope, Plus Jakarta Sans,
 * Figtree, Sora) glifning oʻzi yoʻq — belgi fallback shriftga tushib,
 * matn oʻrtasida boshqa shrift boʻlib koʻrinadi. Loyihada bu belgi
 * 300 dan ortiq joyda ishlatiladi.
 *
 * Cyrillic subseti oʻquvchi/ota-ona ismlari kirilchada kiritilishi
 * mumkinligi uchun qoʻshilgan.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "700"],
  variable: "--font-inter",
  display: "swap",
});

const onest = Onest({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["600", "700"],
  variable: "--font-onest",
  display: "swap",
});

export const metadata: Metadata = {
  // Sarlavha endi bitta kabinetga bogʻlanmaydi — ustoz, oʻquvchi va
  // rahbariyat kabinetlari bir xil ildiz layoutdan foydalanadi.
  title: {
    default: "Tarbion — maktab boshqaruv platformasi",
    template: "%s · Tarbion",
  },
  description:
    "Tarbion xususiy maktabi platformasi: davomat, dars rejasi, jurnal, "
    + "uy vazifasi va hisobotlar.",
  // Belgi app/icon.png va app/apple-icon.png dan avtomatik olinadi.
  applicationName: "Tarbion",
};

/** Next.js 15 da themeColor metadata emas, viewport eksportida boʻladi. */
export const viewport: Viewport = {
  themeColor: "#16803c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="uz"
      className={`h-full antialiased ${inter.variable} ${onest.variable}`}
    >
      {/* Brauzer kengaytmalari (ColorZilla, Grammarly va h.k.) sahifa
          yuklanganda `body` ga oʻz atributlarini qoʻshadi — React esa buni
          server HTML'idan farq deb hisoblaydi. Ogohlantirish faqat shu
          elementning atributlariga tegishli, ichkaridagi haqiqiy
          nomuvofiqliklar baribir koʻrinadi. */}
      <body suppressHydrationWarning className="min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
