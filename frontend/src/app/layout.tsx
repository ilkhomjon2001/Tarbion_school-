import type { Metadata, Viewport } from "next";
import { Lora } from "next/font/google";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
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
    <html lang="uz" className={`h-full antialiased ${lora.variable}`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
