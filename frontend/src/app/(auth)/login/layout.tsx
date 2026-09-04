import type { Metadata } from "next";

/**
 * Login — saytning indekslanadigan yagona ochiq sahifasi (`/` shu yerga
 * yoʻnaltiradi). Sarlavha ATAYLAB berilmagan: ildiz layoutdagi brend
 * sarlavhasi («Tarbion — maktab boshqaruv platformasi») qidiruvda
 * aynan shu sahifa uchun chiqadi.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
