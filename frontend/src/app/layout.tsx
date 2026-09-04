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
  // Qidiruv va ulashish uchun mutlaq manzillar shu bazadan quriladi.
  metadataBase: new URL("https://tarbion.uz"),
  // Sarlavha endi bitta kabinetga bogʻlanmaydi — ustoz, oʻquvchi va
  // rahbariyat kabinetlari bir xil ildiz layoutdan foydalanadi.
  title: {
    default: "Tarbion — maktab boshqaruv platformasi",
    template: "%s · Tarbion",
  },
  description:
    "Tarbion xususiy maktabining rasmiy platformasi: davomat, dars jadvali, "
    + "jurnal, uy vazifasi, toʻlovlar va hisobotlar — ustoz, oʻquvchi va "
    + "ota-onalar uchun yagona tizim.",
  // Belgi app/icon.png va app/apple-icon.png dan avtomatik olinadi.
  applicationName: "Tarbion",
  keywords: [
    "Tarbion",
    "Tarbion maktabi",
    "maktab boshqaruv tizimi",
    "elektron jurnal",
    "davomat",
  ],
  openGraph: {
    type: "website",
    url: "https://tarbion.uz",
    siteName: "Tarbion",
    locale: "uz_UZ",
    title: "Tarbion — maktab boshqaruv platformasi",
    description:
      "Tarbion xususiy maktabining rasmiy platformasi: davomat, jurnal, "
      + "uy vazifasi va hisobotlar.",
    images: [{ url: "/logo/tarbion-lockup.png", alt: "Tarbion" }],
  },
  robots: {
    index: true,
    follow: true,
  },
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
        {/* Qidiruv tizimlari uchun tashkilot maʼlumoti (JSON-LD).
            Brend soʻrovida («tarbion») saytning rasmiy ekanini va
            logotipni aniq bildiradi. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalOrganization",
              name: "Tarbion",
              alternateName: "Tarbion xususiy maktabi",
              url: "https://tarbion.uz",
              logo: "https://tarbion.uz/logo/tarbion-mark.png",
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
