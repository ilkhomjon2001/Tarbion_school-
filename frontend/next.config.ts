import type { NextConfig } from "next";

/**
 * Xavfsizlik sarlavhalari (X-4, NFR-08).
 *
 * Backend oʻz javoblariga bularni allaqachon qoʻyadi
 * (`core/middleware.py` → `SecurityHeadersMiddleware`), lekin Caddy
 * `/api/*` dan boshqa hamma narsani Next.js ga uzatadi va u hech
 * qanday sarlavha qoʻymaydi. Yaʼni kabinet SAHIFALARI himoyasiz
 * qolgan edi — eng muhimi `frame-ancestors` yoʻqligi: hujumchi
 * administrator panelini oʻz sahifasiga iframe qilib, foydalanuvchini
 * koʻrinmas tugmani bosishga majburlashi mumkin (clickjacking).
 *
 * CSP ataylab TOʻLIQ emas: `script-src` qoʻyilsa Next.js ning
 * hidratsiya skriptlari uchun nonce kerak boʻladi, u esa butun
 * ilovani sinovdan oʻtkazishni talab qiladi. Bu yerda faqat
 * buzilmaydigan va aniq foyda beradigan qismlar:
 * ramkaga solishni, `<base>` bilan havolalarni oʻgʻirlashni va
 * formani begona manzilga yuborishni toʻsadi.
 */
const XAVFSIZLIK_SARLAVHALARI = [
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  // Eski brauzerlar `frame-ancestors` ni tushunmaydi.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Bir yil. Backend ham shuni qoʻyadi — ikkalasi bir xil domenda,
  // shuning uchun qiymatlar mos boʻlishi kerak.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Chap pastdagi qora "N" tugmasi (Next.js dev indikatori) oʻchirildi.
  // U dizaynni toʻsib turadi va demo koʻrsatilganda chalgʻitadi.
  // Faqat ishlab chiqish rejimiga taʼsir qiladi, `next build` ga emas.
  devIndicators: false,

  // `x-powered-by: Next.js` — hujumchiga qaysi texnologiya va taxminan
  // qaysi zaifliklar roʻyxatidan boshlashni aytadi. Foydasi yoʻq.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: XAVFSIZLIK_SARLAVHALARI }];
  },
};

export default nextConfig;
