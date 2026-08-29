import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="uz" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
