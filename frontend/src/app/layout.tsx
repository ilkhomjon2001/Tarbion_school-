import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tarbion — Oʻquvchi kabineti",
  description: "Tarbion maktab boshqaruv platformasi, oʻquvchi kabineti (demo).",
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
