import type { MetadataRoute } from "next";

/** Indekslanadigan ochiq sahifalar. Kabinetlar kirmaydi (robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://tarbion.uz/login",
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
