import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chap pastdagi qora "N" tugmasi (Next.js dev indikatori) oʻchirildi.
  // U dizaynni toʻsib turadi va demo koʻrsatilganda chalgʻitadi.
  // Faqat ishlab chiqish rejimiga taʼsir qiladi, `next build` ga emas.
  devIndicators: false,
};

export default nextConfig;
