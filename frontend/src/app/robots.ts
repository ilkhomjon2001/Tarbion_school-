import type { MetadataRoute } from "next";

/**
 * Qidiruv botlariga koʻrsatma. Kabinetlar autentifikatsiya ortida —
 * ularni indekslashga urinish faqat «login sahifasi nusxalari»ni
 * qidiruvga chiqarardi. Ochiq sahifa bitta: /login (root unga
 * yoʻnaltiradi).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/teacher",
        "/student",
        "/ota-ona",
        "/rahbar",
        "/oquv-bolim",
        "/parol",
        "/ikki-bosqich",
        "/parolni-tiklash",
      ],
    },
    sitemap: "https://tarbion.uz/sitemap.xml",
  };
}
